"""Add fields synced from ai-job-search (fit score, role type, prep files)

Revision ID: a7b8c9d0e1f2
Revises: f6a7b8c9d0e1
Create Date: 2026-10-15 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'a7b8c9d0e1f2'
down_revision: Union[str, Sequence[str], None] = 'f6a7b8c9d0e1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

COLUMNS = [
    sa.Column('fit_score', sa.Integer(), nullable=True),
    sa.Column('role_type', sa.String(), nullable=True),
    sa.Column('cv_file', sa.String(), nullable=True),
    sa.Column('cover_letter_file', sa.String(), nullable=True),
    sa.Column('research_file', sa.String(), nullable=True),
]


def upgrade() -> None:
    for column in COLUMNS:
        op.add_column('application', column)


def downgrade() -> None:
    for column in reversed(COLUMNS):
        op.drop_column('application', column.name)
