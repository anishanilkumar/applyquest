from sqlalchemy import Column, String, Integer, DateTime, Date
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
import uuid
from datetime import datetime, timezone
from app.db.base_class import Base

class User(Base):
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    current_education = Column(String, nullable=True)
    german_level = Column(String, nullable=True)
    current_role = Column(String, nullable=True)
    # points removed - will be calculated from point_history
    level = Column(Integer, default=1)
    level_name = Column(String, default='Novice')
    current_streak = Column(Integer, default=0)
    longest_streak = Column(Integer, default=0)
    last_goal_bonus_date = Column(Date, nullable=True)
    # Runway: the date the search must end by (e.g. a visa window), how long
    # hiring takes from application to offer, and how much of the window the
    # paperwork after an offer needs. See frontend utils/runway.ts.
    search_deadline = Column(Date, nullable=True)
    hiring_weeks = Column(Integer, nullable=False, default=6, server_default='6')
    paperwork_weeks = Column(Integer, nullable=False, default=4, server_default='4')
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc).replace(tzinfo=None))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc).replace(tzinfo=None), onupdate=lambda: datetime.now(timezone.utc).replace(tzinfo=None))

    applications = relationship("Application", back_populates="user")
    network_contacts = relationship("NetworkContact", back_populates="user")
    point_history = relationship("PointHistory", back_populates="user", cascade="all, delete-orphan")
    
    @property
    def points(self) -> int:
        """Calculate total points from point history"""
        return sum(ph.points for ph in self.point_history)
