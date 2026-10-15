from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import MagicMock
from uuid import uuid4

import pytest
from fastapi import HTTPException
from pydantic import ValidationError

from app.api.v1.endpoints.interviews import create_interview, update_interview
from app.models.interview import Interview
from app.schemas.interview import InterviewCreate, InterviewUpdate

BERLIN = timezone(timedelta(hours=2))
START = datetime(2026, 10, 16, 16, 0, tzinfo=BERLIN)


def make_db(owner=True, existing=None):
    db = MagicMock()
    db.query.return_value.filter.return_value.first.return_value = SimpleNamespace(id="app-1") if owner else None
    db.query.return_value.join.return_value.filter.return_value.filter.return_value.first.return_value = existing
    return db


def user():
    return SimpleNamespace(id="user-1")


def test_starts_at_needs_an_offset():
    with pytest.raises(ValidationError):
        InterviewCreate(application_id=uuid4(), starts_at=datetime(2026, 10, 16, 16, 0))


def test_ends_at_must_follow_starts_at():
    with pytest.raises(ValidationError):
        InterviewCreate(application_id=uuid4(), starts_at=START, ends_at=START - timedelta(minutes=5))


def test_creating_for_someone_elses_application_404s():
    with pytest.raises(HTTPException) as err:
        create_interview(db=make_db(owner=False), interview_in=InterviewCreate(application_id=uuid4(), starts_at=START), current_user=user())
    assert err.value.status_code == 404


def test_same_calendar_event_updates_instead_of_duplicating():
    existing = Interview(starts_at=START, calendar_event_id="evt-1", stage="Phone Screen")
    db = make_db(existing=existing)
    moved = START + timedelta(days=1)
    result = create_interview(
        db=db, current_user=user(),
        interview_in=InterviewCreate(application_id=uuid4(), starts_at=moved, calendar_event_id="evt-1", stage="Phone Screen"),
    )
    assert result is existing
    assert existing.starts_at == moved
    db.add.assert_called_once_with(existing)


def test_update_rejects_an_end_before_the_start():
    existing = Interview(starts_at=START)
    db = MagicMock()
    db.query.return_value.join.return_value.filter.return_value.filter.return_value.first.return_value = existing
    with pytest.raises(HTTPException) as err:
        update_interview(db=db, id="i-1", interview_in=InterviewUpdate(ends_at=START - timedelta(hours=1)), current_user=user())
    assert err.value.status_code == 422
