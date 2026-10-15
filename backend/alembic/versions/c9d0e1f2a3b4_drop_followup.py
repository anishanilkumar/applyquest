"""Drop the follow-up tracking columns (feature removed)

Revision ID: c9d0e1f2a3b4
Revises: b8c9d0e1f2a3
Create Date: 2026-10-15 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'c9d0e1f2a3b4'
down_revision: Union[str, Sequence[str], None] = 'b8c9d0e1f2a3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_column('application', 'followup_flagged')
    op.drop_column('application', 'followed_up_at')


def downgrade() -> None:
    op.add_column('application', sa.Column('followed_up_at', sa.Date(), nullable=True))
    op.add_column('application', sa.Column('followup_flagged', sa.Boolean(), nullable=False, server_default='false'))
