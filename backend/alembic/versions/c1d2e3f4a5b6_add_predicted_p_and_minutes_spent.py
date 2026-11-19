"""Add predicted_p and minutes_spent: what the odds model said at sending, and the time it took

predicted_p is written by the server when a draft moves to Applied, from the
track record as it stood then (core/odds.py), so the model's calibration can
be checked later. Older applications stay empty: a prediction made now would
already know how they went. minutes_spent is a sync field, the time the
application took, for interviews per hour by effort tier.

Revision ID: c1d2e3f4a5b6
Revises: b0c1d2e3f4a5
Create Date: 2026-11-19 00:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = 'c1d2e3f4a5b6'
down_revision: Union[str, Sequence[str], None] = 'b0c1d2e3f4a5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('application', sa.Column('predicted_p', sa.Float(), nullable=True))
    op.add_column('application', sa.Column('minutes_spent', sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column('application', 'minutes_spent')
    op.drop_column('application', 'predicted_p')
