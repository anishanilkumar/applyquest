"""Add Not Applying: a draft the user decided not to send, apart from Rejected

Drafts set aside before this status existed went Shortlisted -> Rejected and
were never sent. They move to Not Applying, their history with them, so
Rejected means only an employer's no.

Revision ID: b0c1d2e3f4a5
Revises: a9b0c1d2e3f4
Create Date: 2026-11-18 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op


revision: str = 'b0c1d2e3f4a5'
down_revision: Union[str, Sequence[str], None] = 'a9b0c1d2e3f4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Rejected now, set aside straight from Shortlisted, and never Applied.
SET_ASIDE = """
    SELECT a.id FROM application a
    WHERE a.status = 'REJECTED'
      AND EXISTS (SELECT 1 FROM applicationhistory h WHERE h.application_id = a.id
                  AND h.old_status = 'SHORTLISTED' AND h.new_status = 'REJECTED')
      AND NOT EXISTS (SELECT 1 FROM applicationhistory h WHERE h.application_id = a.id
                      AND h.new_status = 'APPLIED')
"""


def upgrade() -> None:
    # A new enum value can't be used in the transaction that adds it.
    with op.get_context().autocommit_block():
        op.execute("ALTER TYPE applicationstatus ADD VALUE IF NOT EXISTS 'NOT_APPLYING'")
    op.execute(f"""
        UPDATE applicationhistory SET new_status = 'NOT_APPLYING'
        WHERE new_status = 'REJECTED' AND old_status = 'SHORTLISTED' AND application_id IN ({SET_ASIDE})
    """)
    op.execute(f"""
        UPDATE applicationhistory SET old_status = 'NOT_APPLYING'
        WHERE old_status = 'REJECTED' AND application_id IN (
            SELECT a.id FROM application a WHERE a.status = 'REJECTED'
              AND EXISTS (SELECT 1 FROM applicationhistory h WHERE h.application_id = a.id
                          AND h.old_status = 'SHORTLISTED' AND h.new_status = 'NOT_APPLYING'))
    """)
    op.execute("""
        UPDATE application SET status = 'NOT_APPLYING'
        WHERE status = 'REJECTED' AND EXISTS (
            SELECT 1 FROM applicationhistory h WHERE h.application_id = application.id
              AND h.old_status = 'SHORTLISTED' AND h.new_status = 'NOT_APPLYING')
          AND NOT EXISTS (SELECT 1 FROM applicationhistory h WHERE h.application_id = application.id
                          AND h.new_status = 'APPLIED')
    """)


def downgrade() -> None:
    # PostgreSQL can't drop an enum value; map the rows back and leave the value.
    op.execute("UPDATE applicationhistory SET new_status = 'REJECTED' WHERE new_status = 'NOT_APPLYING'")
    op.execute("UPDATE applicationhistory SET old_status = 'REJECTED' WHERE old_status = 'NOT_APPLYING'")
    op.execute("UPDATE application SET status = 'REJECTED' WHERE status = 'NOT_APPLYING'")
