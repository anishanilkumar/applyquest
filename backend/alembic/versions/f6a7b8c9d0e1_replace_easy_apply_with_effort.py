"""Replace easy_apply with effort (Full / Light / Generic / Unknown)

Revision ID: f6a7b8c9d0e1
Revises: e5f6a7b8c9d0
Create Date: 2026-10-08 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'f6a7b8c9d0e1'
down_revision: Union[str, Sequence[str], None] = 'e5f6a7b8c9d0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

effort_enum = sa.Enum('FULL', 'LIGHT', 'GENERIC', 'UNKNOWN', name='applicationeffort')


def upgrade() -> None:
    effort_enum.create(op.get_bind(), checkfirst=True)
    op.add_column(
        'application',
        sa.Column('effort', effort_enum, nullable=False, server_default='UNKNOWN'),
    )
    # An easy apply is a one-click submit with the standard CV — a generic application.
    op.execute("UPDATE application SET effort = 'GENERIC' WHERE easy_apply")
    op.drop_column('application', 'easy_apply')


def downgrade() -> None:
    op.add_column(
        'application',
        sa.Column('easy_apply', sa.Boolean(), nullable=False, server_default='false'),
    )
    op.execute("UPDATE application SET easy_apply = true WHERE effort = 'GENERIC'")
    op.drop_column('application', 'effort')
    effort_enum.drop(op.get_bind(), checkfirst=True)
