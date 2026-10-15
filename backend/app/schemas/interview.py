from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, model_validator


class InterviewBase(BaseModel):
    starts_at: datetime
    ends_at: Optional[datetime] = None
    stage: Optional[str] = None
    title: Optional[str] = None
    meeting_url: Optional[str] = None
    interviewers: Optional[str] = None
    notes: Optional[str] = None
    calendar_event_id: Optional[str] = None

    @model_validator(mode="after")
    def _times(self):
        if self.starts_at.tzinfo is None:
            raise ValueError("starts_at needs a UTC offset, e.g. 2026-10-16T16:00:00+02:00")
        if self.ends_at is not None and (self.ends_at.tzinfo is None or self.ends_at <= self.starts_at):
            raise ValueError("ends_at must have a UTC offset and come after starts_at")
        return self


class InterviewCreate(InterviewBase):
    application_id: UUID


class InterviewUpdate(BaseModel):
    starts_at: Optional[datetime] = None
    ends_at: Optional[datetime] = None
    stage: Optional[str] = None
    title: Optional[str] = None
    meeting_url: Optional[str] = None
    interviewers: Optional[str] = None
    notes: Optional[str] = None


class Interview(InterviewBase):
    id: UUID
    application_id: UUID
    created_at: datetime

    class Config:
        from_attributes = True
