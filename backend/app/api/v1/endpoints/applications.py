from typing import Any, List, Optional
from datetime import date
from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy import or_
from sqlalchemy.orm import Session
from app.api import deps
from app.models import application as application_model
from app.models import user as user_model
from app.schemas import application as application_schema
from app.models.application import ApplicationStatus

router = APIRouter()

@router.get("/", response_model=List[application_schema.Application])
def read_applications(
    skip: int = 0,
    limit: Optional[int] = None,
    status: Optional[ApplicationStatus] = None,
    q: Optional[str] = None,
    db: Session = Depends(deps.get_db),
    current_user: user_model.User = Depends(deps.get_current_user),
) -> Any:
    """
    Retrieve applications, newest first.

    `status` filters exactly; `q` matches company or position, case-insensitively.
    Both run in SQL so callers never page through the whole table to search it.
    """
    Application = application_model.Application
    query = db.query(Application).filter(Application.user_id == current_user.id)
    if status is not None:
        query = query.filter(Application.status == status)
    if q and q.strip():
        escaped = q.strip().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        pattern = f"%{escaped}%"
        query = query.filter(or_(
            Application.company_name.ilike(pattern, escape="\\"),
            Application.position_title.ilike(pattern, escape="\\"),
        ))
    query = query.order_by(Application.created_at.desc(), Application.id).offset(skip)
    if limit is not None:
        query = query.limit(limit)
    applications = query.all()
    return applications

@router.post("/", response_model=application_schema.Application)
def create_application(
    *,
    db: Session = Depends(deps.get_db),
    application_in: application_schema.ApplicationCreate,
    current_user: user_model.User = Depends(deps.get_current_user),
) -> Any:
    """
    Create new application.
    """
    application = application_model.Application(
        **application_in.dict(),
        user_id=current_user.id
    )
    db.add(application)
    db.flush()  # Get the application ID
    
    # Update gamification stats (2 points)
    from app.core import gamification
    gamification.add_points(
        db=db,
        user=current_user,
        points=2,
        reason="Created new application",
        reference_type="application",
        reference_id=application.id
    )
    
    db.commit()
    db.refresh(application)

    total_count = db.query(application_model.Application).filter(
        application_model.Application.user_id == current_user.id
    ).count()
    if total_count in {10, 25, 50, 100}:
        from app.core.email import notify_milestone
        notify_milestone(current_user.name, total_count)

    return application

@router.get("/{id}", response_model=application_schema.Application)
def read_application(
    *,
    db: Session = Depends(deps.get_db),
    id: str,
    current_user: user_model.User = Depends(deps.get_current_user),
) -> Any:
    """
    Get application by ID.
    """
    application = db.query(application_model.Application).filter(
        application_model.Application.id == id,
        application_model.Application.user_id == current_user.id
    ).first()
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")
    return application

@router.put("/{id}", response_model=application_schema.Application)
def update_application(
    *,
    db: Session = Depends(deps.get_db),
    id: str,
    application_in: application_schema.ApplicationUpdate,
    current_user: user_model.User = Depends(deps.get_current_user),
) -> Any:
    """
    Update an application.
    """
    application = db.query(application_model.Application).filter(
        application_model.Application.id == id,
        application_model.Application.user_id == current_user.id
    ).first()
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")
    
    update_data = application_in.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(application, field, value)
    
    db.add(application)
    
    # Update gamification stats (1 point for update)
    from app.core import gamification
    gamification.add_points(
        db=db,
        user=current_user,
        points=1,
        reason="Updated application",
        reference_type="application",
        reference_id=application.id
    )
    
    db.commit()
    db.refresh(application)
    return application

# The forward pipeline, in order. Rejected and Ghosted sit outside it.
PIPELINE = [
    ApplicationStatus.SHORTLISTED,
    ApplicationStatus.APPLIED,
    ApplicationStatus.REPLIED,
    ApplicationStatus.PHONE_SCREEN,
    ApplicationStatus.TECHNICAL_ROUND_1,
    ApplicationStatus.TECHNICAL_ROUND_2,
    ApplicationStatus.FINAL_ROUND,
    ApplicationStatus.OFFER,
]

@router.patch("/{id}/status", response_model=application_schema.Application)
def update_application_status(
    *,
    db: Session = Depends(deps.get_db),
    id: str,
    new_status: ApplicationStatus = Body(embed=True),
    notes: str = Body(default=None, embed=True),
    current_user: user_model.User = Depends(deps.get_current_user),
) -> Any:
    """
    Update application status with strict transition rules.
    """
    application = db.query(application_model.Application).filter(
        application_model.Application.id == id,
        application_model.Application.user_id == current_user.id
    ).first()
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")

    current_status = application.status
    
    # Define allowed transitions
    # Map current_status -> allowed_next_statuses
    # A rejected or ghosted application can come back to life (a late reply, a
    # recruiter reopening the role), so either can be reopened at any active stage.
    reopen_statuses = PIPELINE[1:]
    valid_transitions = {
        ApplicationStatus.SHORTLISTED: [ApplicationStatus.APPLIED, ApplicationStatus.REJECTED],
        ApplicationStatus.APPLIED: [ApplicationStatus.REPLIED, ApplicationStatus.REJECTED, ApplicationStatus.GHOSTED],
        ApplicationStatus.REPLIED: [ApplicationStatus.PHONE_SCREEN, ApplicationStatus.REJECTED, ApplicationStatus.GHOSTED],
        ApplicationStatus.PHONE_SCREEN: [ApplicationStatus.TECHNICAL_ROUND_1, ApplicationStatus.REJECTED, ApplicationStatus.GHOSTED],
        ApplicationStatus.TECHNICAL_ROUND_1: [ApplicationStatus.TECHNICAL_ROUND_2, ApplicationStatus.REJECTED, ApplicationStatus.GHOSTED],
        ApplicationStatus.TECHNICAL_ROUND_2: [ApplicationStatus.FINAL_ROUND, ApplicationStatus.REJECTED, ApplicationStatus.GHOSTED],
        ApplicationStatus.FINAL_ROUND: [ApplicationStatus.OFFER, ApplicationStatus.REJECTED, ApplicationStatus.GHOSTED],
        ApplicationStatus.OFFER: [ApplicationStatus.REJECTED, ApplicationStatus.GHOSTED], # Can reject an offer too
        ApplicationStatus.REJECTED: reopen_statuses,
        ApplicationStatus.GHOSTED: [ApplicationStatus.REJECTED, *reopen_statuses],
    }
    
    # Any active stage can also step back one stage, to correct an application
    # that was advanced too far (e.g. a coding test logged as an interview round).
    is_step_back = (
        current_status in PIPELINE[1:]
        and new_status == PIPELINE[PIPELINE.index(current_status) - 1]
    )

    if not is_step_back and new_status not in valid_transitions.get(current_status, []):
         raise HTTPException(
            status_code=400, 
            detail=f"Invalid status transition from {current_status} to {new_status}"
        )

    # Perform update — clear any pending followup since status is changing
    application.status = new_status
    application.followed_up_at = None
    application.followup_flagged = False
    db.add(application)
    
    # Record history
    history = application_model.ApplicationHistory(
        application_id=application.id,
        old_status=current_status,
        new_status=new_status,
        notes=notes
    )
    db.add(history)
    
    db.commit()
    db.refresh(application)

    # A step back is a correction, not news — don't announce it.
    if is_step_back:
        return application

    interview_statuses = {
        ApplicationStatus.PHONE_SCREEN,
        ApplicationStatus.TECHNICAL_ROUND_1,
        ApplicationStatus.TECHNICAL_ROUND_2,
        ApplicationStatus.FINAL_ROUND,
    }
    if new_status in interview_statuses:
        from app.core.email import notify_interview
        notify_interview(current_user.name, application.company_name, application.position_title, new_status.value, notes)
    elif new_status == ApplicationStatus.OFFER:
        from app.core.email import notify_offer
        notify_offer(current_user.name, application.company_name, application.position_title, application.location, application.salary_range, notes)

    return application

@router.post("/{id}/followup", response_model=application_schema.Application)
def mark_followed_up(
    *,
    db: Session = Depends(deps.get_db),
    id: str,
    current_user: user_model.User = Depends(deps.get_current_user),
) -> Any:
    """
    Record that the user followed up on this application today.
    """
    application = db.query(application_model.Application).filter(
        application_model.Application.id == id,
        application_model.Application.user_id == current_user.id
    ).first()
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")

    application.followed_up_at = date.today()
    db.add(application)

    from app.core import gamification
    gamification.add_points(
        db=db,
        user=current_user,
        points=1,
        reason="Followed up on application",
        reference_type="application",
        reference_id=application.id
    )

    db.commit()
    db.refresh(application)
    return application


@router.post("/{id}/followup-flag", response_model=application_schema.Application)
def set_followup_flag(
    *,
    db: Session = Depends(deps.get_db),
    id: str,
    flagged: bool = Body(..., embed=True),
    current_user: user_model.User = Depends(deps.get_current_user),
) -> Any:
    """
    Flag (or unflag) this application as one the user intends to follow up on.
    Only flagged applications appear in the followup queue.
    """
    application = db.query(application_model.Application).filter(
        application_model.Application.id == id,
        application_model.Application.user_id == current_user.id
    ).first()
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")

    application.followup_flagged = flagged
    if not flagged:
        application.followed_up_at = None
    db.add(application)
    db.commit()
    db.refresh(application)
    return application


@router.delete("/{id}", response_model=application_schema.Application)
def delete_application(
    *,
    db: Session = Depends(deps.get_db),
    id: str,
    current_user: user_model.User = Depends(deps.get_current_user),
) -> Any:
    """
    Delete an application.
    """
    application = db.query(application_model.Application).filter(
        application_model.Application.id == id,
        application_model.Application.user_id == current_user.id
    ).first()
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")
    
    db.delete(application)
    db.commit()
    return application
