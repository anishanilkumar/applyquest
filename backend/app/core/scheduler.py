import logging
from datetime import timedelta

import pytz
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger

logger = logging.getLogger(__name__)

BERLIN = pytz.timezone("Europe/Berlin")

scheduler = BackgroundScheduler(timezone=BERLIN)


def _utc_naive_to_berlin_date(naive_utc_dt):
    """Convert a naive UTC datetime stored in the DB to a Berlin-local date."""
    if naive_utc_dt is None:
        return None
    utc_dt = pytz.utc.localize(naive_utc_dt)
    return utc_dt.astimezone(BERLIN).date()


def _load_user(db):
    from app.models.user import User
    from app.core.config import settings
    return db.query(User).filter(User.email == settings.USER_EMAIL).first()


def job_daily_reminder():
    """8 PM Berlin — remind user if no activity today (skips off-days)."""
    from datetime import datetime
    from app.db.session import SessionLocal
    from app.core.working_days import load_off_days, _is_off_day
    from app.core.email import notify_daily_reminder

    today = datetime.now(BERLIN).date()
    if _is_off_day(today, load_off_days()):
        return

    db = SessionLocal()
    try:
        user = _load_user(db)
        if user is None:
            return
        if _utc_naive_to_berlin_date(user.updated_at) == today:
            return  # Already active today
        notify_daily_reminder(user.name, user.current_streak)
    except Exception:
        logger.exception("Error in daily reminder job")
    finally:
        db.close()


def job_streak_check():
    """Midnight Berlin — notify mentors if yesterday's streak was broken (skips off-days)."""
    from datetime import datetime
    from app.db.session import SessionLocal
    from app.core.working_days import load_off_days, _is_off_day
    from app.core.email import notify_streak_broken

    now = datetime.now(BERLIN)
    yesterday = (now - timedelta(days=1)).date()
    if _is_off_day(yesterday, load_off_days()):
        return  # Streak can't break on off-days

    db = SessionLocal()
    try:
        user = _load_user(db)
        if user is None:
            return
        if user.current_streak <= 1:
            return  # No streak worth reporting
        if _utc_naive_to_berlin_date(user.updated_at) == yesterday:
            return  # Was active yesterday — streak intact
        notify_streak_broken(user.name, user.current_streak)
    except Exception:
        logger.exception("Error in streak check job")
    finally:
        db.close()


def job_weekly_summary():
    """Sunday 7 PM Berlin — send weekly summary to mentors."""
    from datetime import datetime
    from app.db.session import SessionLocal
    from app.models.application import Application
    from app.core.email import notify_weekly_summary

    db = SessionLocal()
    try:
        user = _load_user(db)
        if user is None:
            return

        applications = db.query(Application).filter(Application.user_id == user.id).all()
        total = len(applications)

        week_start = datetime.now(BERLIN).date() - timedelta(days=7)
        apps_this_week = sum(
            1 for a in applications
            if a.created_at and a.created_at.date() >= week_start
        )
        responded = sum(1 for a in applications if a.status not in ("Applied", "Ghosted"))
        interviewed = sum(
            1 for a in applications
            if a.status in ("Phone Screen", "Technical Round 1", "Technical Round 2", "Final Round")
        )
        active = sum(1 for a in applications if a.status not in ("Rejected", "Ghosted", "Offer"))

        from datetime import datetime as dt
        from app.core.followup import needs_followup, needs_decision

        today = dt.now(BERLIN).date()
        followup_needed = sum(1 for a in applications if needs_followup(a, today))
        decision_needed = sum(1 for a in applications if needs_decision(a, today))

        notify_weekly_summary(
            user_name=user.name,
            current_streak=user.current_streak,
            longest_streak=user.longest_streak,
            level=user.level,
            level_name=user.level_name,
            points=user.points,
            total_apps=total,
            apps_this_week=apps_this_week,
            response_rate=round((responded / total) * 100) if total else 0,
            interview_rate=round((interviewed / total) * 100) if total else 0,
            active_apps=active,
            followup_needed=followup_needed,
            decision_needed=decision_needed,
        )
    except Exception:
        logger.exception("Error in weekly summary job")
    finally:
        db.close()


def start_scheduler():
    scheduler.add_job(job_daily_reminder, CronTrigger(hour=20, minute=0, timezone=BERLIN))
    scheduler.add_job(job_streak_check, CronTrigger(hour=0, minute=5, timezone=BERLIN))
    scheduler.add_job(job_weekly_summary, CronTrigger(day_of_week="sun", hour=19, minute=0, timezone=BERLIN))
    scheduler.start()
    logger.info("Scheduler started")


def stop_scheduler():
    scheduler.shutdown(wait=False)
    logger.info("Scheduler stopped")
