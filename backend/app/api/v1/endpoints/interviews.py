from datetime import datetime
from typing import Any, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api import deps
from app.models.application import Application
from app.models.interview import Interview
from app.models import user as user_model
from app.schemas import interview as interview_schema

router = APIRouter()


def _own_interviews(db: Session, user):
    return db.query(Interview).join(Application).filter(Application.user_id == user.id)


def _get(db: Session, user, id) -> Interview:
    interview = _own_interviews(db, user).filter(Interview.id == id).first()
    if not interview:
        raise HTTPException(status_code=404, detail="Interview not found")
    return interview


@router.get("/", response_model=List[interview_schema.Interview])
def read_interviews(
    after: Optional[datetime] = None,
    before: Optional[datetime] = None,
    db: Session = Depends(deps.get_db),
    current_user: user_model.User = Depends(deps.get_current_user),
) -> Any:
    """Interviews in time order; `after`/`before` bound starts_at."""
    query = _own_interviews(db, current_user)
    if after is not None:
        query = query.filter(Interview.starts_at >= after)
    if before is not None:
        query = query.filter(Interview.starts_at < before)
    return query.order_by(Interview.starts_at).all()


@router.post("/", response_model=interview_schema.Interview)
def create_interview(
    *,
    db: Session = Depends(deps.get_db),
    interview_in: interview_schema.InterviewCreate,
    current_user: user_model.User = Depends(deps.get_current_user),
) -> Any:
    """Record an interview. Re-posting the same calendar_event_id updates it instead."""
    owner = db.query(Application).filter(
        Application.id == interview_in.application_id, Application.user_id == current_user.id
    ).first()
    if not owner:
        raise HTTPException(status_code=404, detail="Application not found")

    interview = None
    if interview_in.calendar_event_id:
        interview = _own_interviews(db, current_user).filter(
            Interview.calendar_event_id == interview_in.calendar_event_id
        ).first()
    if interview is None:
        interview = Interview()
    for field, value in interview_in.dict().items():
        setattr(interview, field, value)
    db.add(interview)
    db.commit()
    db.refresh(interview)
    return interview


@router.put("/{id}", response_model=interview_schema.Interview)
def update_interview(
    *,
    db: Session = Depends(deps.get_db),
    id: str,
    interview_in: interview_schema.InterviewUpdate,
    current_user: user_model.User = Depends(deps.get_current_user),
) -> Any:
    interview = _get(db, current_user, id)
    for field, value in interview_in.dict(exclude_unset=True).items():
        setattr(interview, field, value)
    starts, ends = interview.starts_at, interview.ends_at
    if starts is None or starts.tzinfo is None or (ends is not None and ends <= starts):
        raise HTTPException(status_code=422, detail="starts_at needs a UTC offset and must precede ends_at")
    db.add(interview)
    db.commit()
    db.refresh(interview)
    return interview


@router.delete("/{id}", response_model=interview_schema.Interview)
def delete_interview(
    *,
    db: Session = Depends(deps.get_db),
    id: str,
    current_user: user_model.User = Depends(deps.get_current_user),
) -> Any:
    interview = _get(db, current_user, id)
    db.delete(interview)
    db.commit()
    return interview
