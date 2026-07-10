from sqlalchemy import Column, String, Integer, DateTime, Boolean, Enum, Text, ForeignKey, Date
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
import uuid
from datetime import datetime, date, timezone
import enum
from app.db.base_class import Base

class ApplicationStatus(str, enum.Enum):
    SHORTLISTED = "Shortlisted"
    APPLIED = "Applied"
    REPLIED = "Replied"
    PHONE_SCREEN = "Phone Screen"
    TECHNICAL_ROUND_1 = "Technical Round 1"
    TECHNICAL_ROUND_2 = "Technical Round 2"
    FINAL_ROUND = "Final Round"
    OFFER = "Offer"
    REJECTED = "Rejected"
    GHOSTED = "Ghosted"

class GermanLevel(str, enum.Enum):
    NONE = "None"
    BASIC = "Basic"
    FLUENT = "Fluent"

class Application(Base):
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("user.id"), nullable=False)
    company_name = Column(String, nullable=False)
    position_title = Column(String, nullable=False)
    location = Column(String, nullable=False)
    job_url = Column(String, nullable=True)
    salary_range = Column(String, nullable=True)
    tech_stack = Column(String, nullable=True)
    status = Column(Enum(ApplicationStatus), default=ApplicationStatus.SHORTLISTED, nullable=False)
    visa_sponsorship = Column(Boolean, default=False)
    german_requirement = Column(Enum(GermanLevel), default=GermanLevel.NONE)
    relocation_support = Column(Boolean, default=False)
    easy_apply = Column(Boolean, default=False)
    job_board_source = Column(String, nullable=True)
    priority_stars = Column(Integer, default=0)
    notes = Column(Text, nullable=True)
    applied_date = Column(Date, default=date.today)
    followed_up_at = Column(Date, nullable=True)
    followup_flagged = Column(Boolean, default=False, nullable=False, server_default='false')
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc).replace(tzinfo=None))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc).replace(tzinfo=None), onupdate=lambda: datetime.now(timezone.utc).replace(tzinfo=None))
    referral_contact_id = Column(UUID(as_uuid=True), ForeignKey("networkcontact.id", ondelete="SET NULL"), nullable=True)

    user = relationship("User", back_populates="applications")
    history = relationship("ApplicationHistory", back_populates="application", cascade="all, delete-orphan")
    network_contacts = relationship("NetworkContact", foreign_keys="NetworkContact.application_id", back_populates="application")
    referral_contact = relationship("NetworkContact", primaryjoin="Application.referral_contact_id==NetworkContact.id", post_update=True, uselist=False)

class ApplicationHistory(Base):
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    application_id = Column(UUID(as_uuid=True), ForeignKey("application.id"), nullable=False)
    old_status = Column(Enum(ApplicationStatus), nullable=True)
    new_status = Column(Enum(ApplicationStatus), nullable=False)
    changed_at = Column(DateTime, default=lambda: datetime.now(timezone.utc).replace(tzinfo=None))
    notes = Column(Text, nullable=True)

    application = relationship("Application", back_populates="history")
