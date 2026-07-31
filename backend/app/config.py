from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str
    cors_origins: list[str] = ["http://localhost:5173"]  # Vite dev server default port

    # File attachments (PDFs, images, etc.) are stored on disk, not in Postgres —
    # Postgres isn't a good fit for large binary blobs at any scale, and on a
    # Raspberry Pi you especially don't want to bloat the DB with file bytes.
    # Only the file's path/URL and metadata (name, size, type) go in the DB.
    uploads_dir: str = "uploads"
    max_upload_size_mb: int = 25

    # Reminder emails — all optional. If left blank, the reminder scheduler
    # still runs but skips sending (logs a warning) rather than crashing the
    # whole app on startup just because email isn't configured yet.
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from: str = ""
    reminder_to_email: str = ""

    class Config:
        env_file = ".env"


settings = Settings()
