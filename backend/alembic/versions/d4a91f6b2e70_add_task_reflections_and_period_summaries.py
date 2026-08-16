"""add task reflections and period summaries

Revision ID: d4a91f6b2e70
Revises: c7e3b5a91d24
Create Date: 2026-08-16 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'd4a91f6b2e70'
down_revision: Union[str, Sequence[str], None] = 'c7e3b5a91d24'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # All nullable: every task that already exists was finished (or not) before
    # the reflection prompt existed, and skipping the prompt has to stay a
    # first-class outcome rather than something the schema forbids.
    op.add_column('tasks', sa.Column('satisfaction', sa.Integer(), nullable=True))
    op.add_column('tasks', sa.Column('reflection', sa.Text(), nullable=True))
    op.add_column(
        'tasks', sa.Column('reflected_at', sa.DateTime(timezone=True), nullable=True)
    )

    op.create_table(
        'period_summaries',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('period', sa.String(), nullable=False),
        sa.Column('period_start', sa.Date(), nullable=False),
        sa.Column('period_end', sa.Date(), nullable=False),
        sa.Column('label', sa.String(), nullable=False),
        sa.Column('headline', sa.String(), nullable=False),
        sa.Column('narrative', sa.Text(), nullable=False),
        sa.Column(
            'themes',
            postgresql.JSONB(astext_type=sa.Text()),
            server_default=sa.text("'[]'::jsonb"),
            nullable=False,
        ),
        sa.Column('advice', sa.Text(), nullable=True),
        sa.Column('task_count', sa.Integer(), server_default='0', nullable=False),
        sa.Column('model', sa.String(), nullable=True),
        sa.Column('created_on', sa.Date(), nullable=False),
        sa.Column(
            'created_at',
            sa.DateTime(timezone=True),
            server_default=sa.text('now()'),
            nullable=True,
        ),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_period_summaries_id'), 'period_summaries', ['id'], unique=False)
    # The daily-quota check is always `WHERE created_on = <today>`, exactly as
    # for growth_tips.
    op.create_index(
        op.f('ix_period_summaries_created_on'), 'period_summaries', ['created_on'], unique=False
    )
    # Every read is "the newest summary for this window", so the lookup pair is
    # indexed together rather than separately.
    op.create_index(
        'ix_period_summaries_window',
        'period_summaries',
        ['period', 'period_start'],
        unique=False,
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index('ix_period_summaries_window', table_name='period_summaries')
    op.drop_index(op.f('ix_period_summaries_created_on'), table_name='period_summaries')
    op.drop_index(op.f('ix_period_summaries_id'), table_name='period_summaries')
    op.drop_table('period_summaries')

    op.drop_column('tasks', 'reflected_at')
    op.drop_column('tasks', 'reflection')
    op.drop_column('tasks', 'satisfaction')
