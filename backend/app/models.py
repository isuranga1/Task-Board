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
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship

from .database import Base


class TaskStatus(str, enum.Enum):
    todo = "todo"
    in_progress = "in_progress"
    done = "done"


class Section(Base):
    __tablename__ = "sections"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)          # "Jobs", "Music", "Guitar"
    slug = Column(String, unique=True, nullable=False)
    color = Column(String, nullable=True)          # hex color for UI theming
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    subsections = relationship(
        "Subsection", back_populates="section", cascade="all, delete-orphan"
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
    priority = Column(Integer, default=0)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    status = Column(Enum(TaskStatus), default=TaskStatus.todo, nullable=False)
    ticket_code = Column(String, nullable=True)     # e.g. "tai-0001945-dz"
    due_date = Column(Date, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    # Note: mapped to Python attr `task_metadata` because SQLAlchemy reserves
    # the name `metadata` on declarative models — but the actual DB column is
    # still called `metadata`, matching the SQL schema from the setup guide.
    task_metadata = Column("metadata", JSONB, default=dict)  # links[], tags[], avatar_url

    section = relationship("Section", back_populates="tasks")
    subsection = relationship("Subsection", back_populates="tasks")
    subtasks = relationship(
        "Subtask", back_populates="task", cascade="all, delete-orphan",
        order_by="Subtask.position",
    )


class Subtask(Base):
    __tablename__ = "subtasks"

    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("tasks.id", ondelete="CASCADE"))
    title = Column(String, nullable=False)
    is_done = Column(Boolean, default=False)
    position = Column(Integer, default=0)

    task = relationship("Task", back_populates="subtasks")
