"""Add job-search runway settings to user (deadline, hiring and paperwork weeks)

Revision ID: b8c9d0e1f2a3
Revises: a7b8c9d0e1f2
Create Date: 2026-10-15 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'b8c9d0e1f2a3'
down_revision: Union[str, Sequence[str], None] = 'a7b8c9d0e1f2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('user', sa.Column('search_deadline', sa.Date(), nullable=True))
    op.add_column('user', sa.Column('hiring_weeks', sa.Integer(), nullable=False, server_default='6'))
    op.add_column('user', sa.Column('paperwork_weeks', sa.Integer(), nullable=False, server_default='4'))


def downgrade() -> None:
    op.drop_column('user', 'paperwork_weeks')
    op.drop_column('user', 'hiring_weeks')
    op.drop_column('user', 'search_deadline')
