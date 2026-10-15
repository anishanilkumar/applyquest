from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, date
from uuid import UUID
from app.models.application import ApplicationEffort, ApplicationStatus, GermanLevel

class ApplicationBase(BaseModel):
    company_name: str
    position_title: str
    location: str
    job_url: Optional[str] = None
    salary_range: Optional[str] = None
    tech_stack: Optional[str] = None
    status: ApplicationStatus = ApplicationStatus.SHORTLISTED
    visa_sponsorship: bool = False
    german_requirement: GermanLevel = GermanLevel.NONE
    relocation_support: bool = False
    effort: ApplicationEffort = ApplicationEffort.UNKNOWN
    job_board_source: Optional[str] = None
    priority_stars: int = 0
    notes: Optional[str] = None
    applied_date: date
    followed_up_at: Optional[date] = None
    followup_flagged: bool = False
    referral_contact_id: Optional[UUID] = None
    fit_score: Optional[int] = Field(default=None, ge=0, le=100)
    role_type: Optional[str] = None
    cv_file: Optional[str] = None
    cover_letter_file: Optional[str] = None
    research_file: Optional[str] = None

class ApplicationCreate(ApplicationBase):
    pass

class ApplicationUpdate(BaseModel):
    company_name: Optional[str] = None
    position_title: Optional[str] = None
    location: Optional[str] = None
    job_url: Optional[str] = None
    salary_range: Optional[str] = None
    tech_stack: Optional[str] = None
    visa_sponsorship: Optional[bool] = None
    german_requirement: Optional[GermanLevel] = None
    relocation_support: Optional[bool] = None
    effort: Optional[ApplicationEffort] = None
    job_board_source: Optional[str] = None
    priority_stars: Optional[int] = None
    notes: Optional[str] = None
    applied_date: Optional[date] = None
    followed_up_at: Optional[date] = None
    followup_flagged: Optional[bool] = None
    referral_contact_id: Optional[UUID] = None
    fit_score: Optional[int] = Field(default=None, ge=0, le=100)
    role_type: Optional[str] = None
    cv_file: Optional[str] = None
    cover_letter_file: Optional[str] = None
    research_file: Optional[str] = None

class ApplicationHistoryBase(BaseModel):
    old_status: Optional[ApplicationStatus]
    new_status: ApplicationStatus
    notes: Optional[str] = None

class ApplicationHistory(ApplicationHistoryBase):
    id: UUID
    application_id: UUID
    changed_at: datetime

    class Config:
        from_attributes = True

class Application(ApplicationBase):
    id: UUID
    user_id: UUID
    created_at: datetime
    updated_at: datetime
    history: List[ApplicationHistory] = []

    class Config:
        from_attributes = True
