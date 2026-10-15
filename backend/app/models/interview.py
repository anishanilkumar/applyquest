import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.db.base_class import Base


class Interview(Base):
    """A scheduled conversation with an employer, for the Dashboard and calendar.

    Recorded by hand or by ai-job-search's /interview-watch, which reads the
    recruiter's Google Calendar invite; `calendar_event_id` lets it re-record
    the same invite without creating a duplicate.
    """
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    application_id = Column(UUID(as_uuid=True), ForeignKey("application.id", ondelete="CASCADE"), nullable=False, index=True)
    starts_at = Column(DateTime(timezone=True), nullable=False, index=True)
    ends_at = Column(DateTime(timezone=True), nullable=True)
    stage = Column(String, nullable=True)          # e.g. "Phone Screen", "Technical Round 1"
    title = Column(String, nullable=True)          # e.g. "Talent Talk"
    meeting_url = Column(String, nullable=True)
    interviewers = Column(String, nullable=True)   # "Name (Title), Name (Title)"
    notes = Column(Text, nullable=True)
    calendar_event_id = Column(String, nullable=True, index=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc).replace(tzinfo=None))

    application = relationship("Application", back_populates="interviews")
