"""Add streak_freezes: each covers one missed working day

Earned one per five days of streak, at most two held (core/gamification.py).

Revision ID: d2e3f4a5b6c7
Revises: c1d2e3f4a5b6
Create Date: 2026-11-19 12:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = 'd2e3f4a5b6c7'
down_revision: Union[str, Sequence[str], None] = 'c1d2e3f4a5b6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('user', sa.Column('streak_freezes', sa.Integer(), nullable=False, server_default='0'))


def downgrade() -> None:
    op.drop_column('user', 'streak_freezes')
