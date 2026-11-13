from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session, selectinload

from app.api import deps
from app.core import stats
from app.core.working_days import load_off_days
from app.models.application import Application
from app.models.interview import Interview
from app.models import user as user_model

router = APIRouter()


def load_summary(db: Session, user) -> dict:
    """The summary for one user: shared by the endpoint and the scheduler's nudges."""
    apps = (db.query(Application).filter(Application.user_id == user.id)
            .options(selectinload(Application.history)).all())
    upcoming = (db.query(Interview).join(Application).filter(Application.user_id == user.id)
                .filter(Interview.starts_at >= datetime.now(timezone.utc))
                .options(selectinload(Interview.application)).order_by(Interview.starts_at).limit(5).all())
    return stats.summary(user, apps, upcoming, load_off_days())


@router.get("/summary")
def read_summary(
    db: Session = Depends(deps.get_db),
    current_user: user_model.User = Depends(deps.get_current_user),
) -> Any:
    """The job search at a glance (read-only), for Friday's ApplyQuest section."""
    return load_summary(db, current_user)
