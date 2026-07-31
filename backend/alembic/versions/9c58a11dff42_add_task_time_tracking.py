"""add started_at/completed_at to tasks for time tracking

Revision ID: 9c58a11dff42
Revises: 43c4e951bf2a
Create Date: 2026-07-31 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '9c58a11dff42'
down_revision: Union[str, Sequence[str], None] = '43c4e951bf2a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('tasks', sa.Column('started_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('tasks', sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True))
    # Backfill so existing tasks already in progress/done aren't stuck with
    # no badge forever — best-effort using timestamps we already have.
    op.execute(
        "UPDATE tasks SET started_at = updated_at WHERE status = 'in_progress' AND started_at IS NULL"
    )
    op.execute(
        "UPDATE tasks SET completed_at = updated_at WHERE status = 'done' AND completed_at IS NULL"
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('tasks', 'completed_at')
    op.drop_column('tasks', 'started_at')
