"""Add the apply queue's fields: salary ask, whether the range is an estimate, a heads-up

Revision ID: a9b0c1d2e3f4
Revises: e1f2a3b4c5d6
Create Date: 2026-11-18 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'a9b0c1d2e3f4'
down_revision: Union[str, Sequence[str], None] = 'e1f2a3b4c5d6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('application', sa.Column('salary_ask', sa.Integer(), nullable=True))
    op.add_column('application', sa.Column('salary_estimated', sa.Boolean(), nullable=True))
    op.add_column('application', sa.Column('heads_up', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('application', 'heads_up')
    op.drop_column('application', 'salary_estimated')
    op.drop_column('application', 'salary_ask')
