from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from datetime import date, datetime
from uuid import UUID

class UserBase(BaseModel):
    name: str
    email: EmailStr
    current_education: Optional[str] = None
    german_level: Optional[str] = None
    current_role: Optional[str] = None

class UserCreate(UserBase):
    pass

class UserUpdate(UserBase):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    search_deadline: Optional[date] = None
    hiring_weeks: Optional[int] = Field(default=None, ge=1, le=52)
    paperwork_weeks: Optional[int] = Field(default=None, ge=0, le=52)

class User(UserBase):
    id: UUID
    points: int
    level: int
    level_name: str
    current_streak: int
    longest_streak: int
    search_deadline: Optional[date] = None
    hiring_weeks: int = 6
    paperwork_weeks: int = 4
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
