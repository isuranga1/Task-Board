import logging
import smtplib
from datetime import date
from email.message import EmailMessage

from apscheduler.schedulers.background import BackgroundScheduler
from sqlalchemy import select

from . import models
from .config import settings
from .database import SessionLocal

logger = logging.getLogger("reminders")


def send_email(subject: str, body: str) -> bool:
    """Sends one email via SMTP. Returns False (and logs) instead of raising
    if SMTP isn't configured — a missing/wrong email setup should never crash
    the reminder check or, worse, the whole app."""
    if not settings.smtp_host or not settings.reminder_to_email:
        logger.warning("Reminder skipped — SMTP not configured in .env: %s", subject)
        return False

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = settings.smtp_from or settings.smtp_user
    msg["To"] = settings.reminder_to_email
    msg.set_content(body)

    try:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port) as server:
            server.starttls()
            if settings.smtp_user:
                server.login(settings.smtp_user, settings.smtp_password)
            server.send_message(msg)
        return True
    except Exception:
        logger.exception("Failed to send reminder email: %s", subject)
        return False


def check_and_send_reminders():
    """Runs on a schedule (see start_scheduler). Finds every task whose
    remind_at date is today or earlier and hasn't had its reminder sent yet,
    emails once, then flips reminder_sent so it never fires twice."""
    db = SessionLocal()
    try:
        stmt = select(models.Task).where(
            models.Task.remind_at.is_not(None),
            models.Task.remind_at <= date.today(),
            models.Task.reminder_sent.is_(False),
        )
        due_tasks = db.execute(stmt).scalars().all()

        for task in due_tasks:
            subject = f"Reminder: {task.title}"
            body = (
                f"Task: {task.title}\n"
                f"Status: {task.status.value}\n"
                f"Due date: {task.due_date or 'none set'}\n\n"
                f"{task.description or ''}"
            )
            sent = send_email(subject, body)
            if sent:
                task.reminder_sent = True
                db.add(task)

        if due_tasks:
            db.commit()
    finally:
        db.close()


_scheduler: BackgroundScheduler | None = None


def start_scheduler():
    """Called once from main.py's startup event. Checks for due reminders
    once every hour — frequent enough that a reminder set for "today" reliably
    goes out the same day, without hammering the DB with a tighter interval
    that a personal single-user app has no real need for."""
    global _scheduler
    if _scheduler is not None:
        return
    _scheduler = BackgroundScheduler()
    _scheduler.add_job(check_and_send_reminders, "interval", hours=1, id="reminder_check")
    _scheduler.start()
    logger.info("Reminder scheduler started (checks hourly).")
