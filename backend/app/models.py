import enum

from sqlalchemy import (
    Column,
    Integer,
    String,
    Text,
    Date,
    DateTime,
    ForeignKey,
    Enum,
    Boolean,
    Table,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship

from .database import Base


class TaskStatus(str, enum.Enum):
    todo = "todo"
    in_progress = "in_progress"
    done = "done"


class TaskPriority(str, enum.Enum):
    low = "low"
    medium = "medium"
    high = "high"
    urgent = "urgent"


# Self-referential many-to-many: "task_id depends on depends_on_id" means
# task_id cannot be considered truly done until depends_on_id is done.
# A plain association table (not its own model class) is the standard
# SQLAlchemy pattern when the relationship itself carries no extra data
# beyond the two foreign keys.
task_dependencies = Table(
    "task_dependencies",
    Base.metadata,
    Column("task_id", Integer, ForeignKey("tasks.id", ondelete="CASCADE"), primary_key=True),
    Column("depends_on_id", Integer, ForeignKey("tasks.id", ondelete="CASCADE"), primary_key=True),
    UniqueConstraint("task_id", "depends_on_id", name="uq_task_dependency"),
)


class Section(Base):
    __tablename__ = "sections"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)          # "Jobs", "Music", "Guitar"
    slug = Column(String, unique=True, nullable=False)
    color = Column(String, nullable=True)          # hex color for UI theming
    position = Column(Integer, default=0, nullable=False, server_default="0")
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    subsections = relationship(
        "Subsection",
        back_populates="section",
        cascade="all, delete-orphan",
        order_by="Subsection.position, Subsection.id",
    )
    tasks = relationship(
        "Task", back_populates="section", cascade="all, delete-orphan"
    )


class Subsection(Base):
    __tablename__ = "subsections"

    id = Column(Integer, primary_key=True, index=True)
    section_id = Column(Integer, ForeignKey("sections.id", ondelete="CASCADE"))
    name = Column(String, nullable=False)          # "Evaluations", "Song Practice"
    position = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    section = relationship("Section", back_populates="subsections")
    tasks = relationship("Task", back_populates="subsection")


class Task(Base):
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, index=True)
    section_id = Column(Integer, ForeignKey("sections.id", ondelete="CASCADE"))
    subsection_id = Column(
        Integer, ForeignKey("subsections.id", ondelete="SET NULL"), nullable=True
    )
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    status = Column(Enum(TaskStatus), default=TaskStatus.todo, nullable=False)
    priority = Column(Enum(TaskPriority), default=TaskPriority.medium, nullable=False)
    ticket_code = Column(String, nullable=True)     # e.g. "tai-0001945-dz"
    due_date = Column(Date, nullable=True)
    remind_at = Column(Date, nullable=True)          # date to send a reminder email
    reminder_sent = Column(Boolean, default=False, nullable=False)
    # Set/reset whenever the task transitions INTO "in_progress" — powers the
    # live "time in doing" badge and, once `completed_at` is also set, the
    # "took Xh Ym" badge on done cards. Both are nullable: a task that jumps
    # straight from todo to done was never actively timed.
    started_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    # Note: mapped to Python attr `task_metadata` because SQLAlchemy reserves
    # the name `metadata` on declarative models — but the actual DB column is
    # still called `metadata`, matching the SQL schema from the setup guide.
    # `attachments` (uploaded files) also lives here: [{filename, url, size, content_type}]
    task_metadata = Column("metadata", JSONB, default=dict)  # links[], tags[], attachments[]

    section = relationship("Section", back_populates="tasks")
    subsection = relationship("Subsection", back_populates="tasks")
    subtasks = relationship(
        "Subtask", back_populates="task", cascade="all, delete-orphan",
        order_by="Subtask.position",
    )

    # `depends_on`: the tasks THIS task is blocked by (must finish first).
    # `blocks`: the tasks that are blocked BY this one — the reverse view,
    # computed automatically by SQLAlchemy from the same association table
    # via `secondaryjoin`/`primaryjoin` swapped.
    depends_on = relationship(
        "Task",
        secondary=task_dependencies,
        primaryjoin=id == task_dependencies.c.task_id,
        secondaryjoin=id == task_dependencies.c.depends_on_id,
        backref="blocks",
    )


class GoogleCredential(Base):
    """The one connected Google account's OAuth tokens.

    This is a deliberately single-row table (always id=1, see crud.get_google_credential):
    the app has no user accounts, so "connected to Google" is a property of the
    deployment, not of a person. Modelling it as a table rather than a config
    file is what lets the refresh token survive container rebuilds — it lives in
    the same Postgres volume as everything else, and gets picked up by the
    existing backup script for free.
    """

    __tablename__ = "google_credentials"

    id = Column(Integer, primary_key=True)
    account_email = Column(String, nullable=True)   # shown in the UI so you know which account is linked
    access_token = Column(Text, nullable=False)
    # Google only returns a refresh token on the FIRST consent for a client, so
    # this is never overwritten with a null on subsequent refreshes — losing it
    # would mean re-consenting by hand. See gcal.py's _store_tokens.
    refresh_token = Column(Text, nullable=True)
    token_expiry = Column(DateTime(timezone=True), nullable=True)
    scope = Column(Text, nullable=True)
    # Calendar IDs the user ticked in the UI. Empty list = show none; the
    # frontend defaults a fresh connection to every calendar being on.
    selected_calendar_ids = Column(JSONB, default=list, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class Subtask(Base):
    __tablename__ = "subtasks"

    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("tasks.id", ondelete="CASCADE"))
    title = Column(String, nullable=False)
    is_done = Column(Boolean, default=False)
    position = Column(Integer, default=0)

    task = relationship("Task", back_populates="subtasks")
