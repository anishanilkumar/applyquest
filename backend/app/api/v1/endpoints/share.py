from typing import Any
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.api import deps
from app.core.config import settings
from app.models import application as application_model
from app.models import network as network_model
from app.models import user as user_model

router = APIRouter()


class ShareRequest(BaseModel):
    password: str


@router.post("/data")
def get_share_data(
    *,
    db: Session = Depends(deps.get_db),
    body: ShareRequest,
) -> Any:
    """
    Return all data for mentor view. Password-protected, no user account needed.
    """
    if body.password != settings.SHARE_PASSWORD:
        raise HTTPException(status_code=401, detail="Invalid password")

    # Single-user app — always load the owner's account by email. USER_EMAIL,
    # not a literal: api/deps.py and core/scheduler.py already resolve the owner
    # that way, and a second instance of this app (the public demo) has a
    # different owner, for which a hardcoded address 404s the whole mentor view.
    user = db.query(user_model.User).filter(user_model.User.email == settings.USER_EMAIL).first()
    if not user:
        raise HTTPException(status_code=404, detail="No user found")

    applications = (
        db.query(application_model.Application)
        .filter(application_model.Application.user_id == user.id)
        .all()
    )

    contacts = (
        db.query(network_model.NetworkContact)
        .filter(network_model.NetworkContact.user_id == user.id)
        .all()
    )

    def serialize_app(app):
        history = [
            {
                "id": h.id,
                "application_id": h.application_id,
                "old_status": h.old_status,
                "new_status": h.new_status,
                "notes": h.notes,
                "changed_at": h.changed_at.isoformat() if h.changed_at else None,
            }
            for h in app.history
        ]
        return {
            "id": app.id,
            "user_id": app.user_id,
            "company_name": app.company_name,
            "position_title": app.position_title,
            "location": app.location,
            "job_url": app.job_url,
            "salary_range": app.salary_range,
            "tech_stack": app.tech_stack,
            "status": app.status,
            "visa_sponsorship": app.visa_sponsorship,
            "german_requirement": app.german_requirement,
            "relocation_support": app.relocation_support,
            "job_board_source": app.job_board_source,
            "priority_stars": app.priority_stars,
            "notes": app.notes,
            "applied_date": app.applied_date.isoformat() if app.applied_date else None,
            "created_at": app.created_at.isoformat() if app.created_at else None,
            "updated_at": app.updated_at.isoformat() if app.updated_at else None,
            "referral_contact_id": app.referral_contact_id,
            "history": history,
        }

    def serialize_contact(c):
        return {
            "id": c.id,
            "user_id": c.user_id,
            "name": c.name,
            "email": c.email,
            "company": c.company,
            "relationship_type": c.relationship_type,
            "connection_strength": c.connection_strength,
            "last_contact_date": c.last_contact_date.isoformat() if c.last_contact_date else None,
            "notes": c.notes,
            "application_id": c.application_id,
            "created_at": c.created_at.isoformat() if c.created_at else None,
        }

    return {
        "user": {
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "current_education": user.current_education,
            "german_level": user.german_level,
            "current_role": user.current_role,
            "points": user.points,
            "level": user.level,
            "level_name": user.level_name,
            "current_streak": user.current_streak,
            "longest_streak": user.longest_streak,
            "created_at": user.created_at.isoformat() if user.created_at else None,
        },
        "applications": [serialize_app(a) for a in applications],
        "contacts": [serialize_contact(c) for c in contacts],
    }
