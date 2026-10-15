"""Add interview table (scheduled conversations with employers)

Revision ID: e1f2a3b4c5d6
Revises: d0e1f2a3b4c5
Create Date: 2026-10-15 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = 'e1f2a3b4c5d6'
down_revision: Union[str, Sequence[str], None] = 'd0e1f2a3b4c5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'interview',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('application_id', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('application.id', ondelete='CASCADE'), nullable=False),
        sa.Column('starts_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('ends_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('stage', sa.String(), nullable=True),
        sa.Column('title', sa.String(), nullable=True),
        sa.Column('meeting_url', sa.String(), nullable=True),
        sa.Column('interviewers', sa.String(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('calendar_event_id', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
    )
    op.create_index('ix_interview_application_id', 'interview', ['application_id'])
    op.create_index('ix_interview_starts_at', 'interview', ['starts_at'])
    op.create_index('ix_interview_calendar_event_id', 'interview', ['calendar_event_id'])


def downgrade() -> None:
    op.drop_table('interview')
