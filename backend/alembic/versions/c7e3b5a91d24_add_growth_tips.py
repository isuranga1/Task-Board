"""add growth_tips table for the Grow orb

Revision ID: c7e3b5a91d24
Revises: b1f2a7c94e05
Create Date: 2026-08-07 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'c7e3b5a91d24'
down_revision: Union[str, Sequence[str], None] = 'b1f2a7c94e05'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'growth_tips',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('topic', sa.String(), nullable=False),
        sa.Column('title', sa.String(), nullable=False),
        sa.Column('body', sa.Text(), nullable=False),
        sa.Column('try_this', sa.Text(), nullable=True),
        sa.Column('model', sa.String(), nullable=True),
        sa.Column('created_on', sa.Date(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_growth_tips_id'), 'growth_tips', ['id'], unique=False)
    # The daily-quota check runs on every /growth/status and every generate, and
    # it is always `WHERE created_on = <today>` — this is the index that keeps
    # that a lookup rather than a scan as the table grows over months of use.
    op.create_index(op.f('ix_growth_tips_created_on'), 'growth_tips', ['created_on'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_growth_tips_created_on'), table_name='growth_tips')
    op.drop_index(op.f('ix_growth_tips_id'), table_name='growth_tips')
    op.drop_table('growth_tips')
