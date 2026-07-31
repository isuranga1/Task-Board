"""add position column to sections for drag-to-reorder

Revision ID: 43c4e951bf2a
Revises: 3c4d88da0cdb
Create Date: 2026-07-31 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '43c4e951bf2a'
down_revision: Union[str, Sequence[str], None] = '3c4d88da0cdb'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        'sections',
        sa.Column('position', sa.Integer(), nullable=False, server_default='0'),
    )
    # Seed existing rows with their current id-based order so they don't all
    # collapse to position 0 and reshuffle unpredictably on first load.
    op.execute(
        """
        UPDATE sections
        SET position = ranked.rank
        FROM (
            SELECT id, ROW_NUMBER() OVER (ORDER BY id) AS rank
            FROM sections
        ) AS ranked
        WHERE sections.id = ranked.id
        """
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('sections', 'position')
