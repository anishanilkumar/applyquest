from datetime import datetime, timedelta, timezone
from app.models.user import User
from app.models.point_history import PointHistory
from app.core.working_days import load_off_days, missed_working_days, streak_is_unbroken
from sqlalchemy.orm import Session
from uuid import UUID

# The first six are as they were; 7-10 came with points for expected interviews
# (core/quest.py), which pay about 30 a send. The frontend's Dashboard reads
# the ladder from the summary's level block.
LEVELS = [
    {"level": 1, "name": "Novice Seeker", "minPoints": 0},
    {"level": 2, "name": "Active Applicant", "minPoints": 100},
    {"level": 3, "name": "Job Hunter", "minPoints": 300},
    {"level": 4, "name": "Networking Pro", "minPoints": 600},
    {"level": 5, "name": "Interview Master", "minPoints": 1000},
    {"level": 6, "name": "Offer Magnet", "minPoints": 1500},
    {"level": 7, "name": "Pipeline Builder", "minPoints": 3000},
    {"level": 8, "name": "Signal Hunter", "minPoints": 5000},
    {"level": 9, "name": "Calibrated", "minPoints": 8000},
    {"level": 10, "name": "Closer", "minPoints": 12000},
]

# A freeze covers one missed working day. One is earned every FREEZE_EVERY
# days of streak, up to FREEZE_CAP held at once.
FREEZE_EVERY = 5
FREEZE_CAP = 2


def next_level(points: int) -> dict | None:
    return next((lv for lv in LEVELS if lv["minPoints"] > points), None)

def add_points(
    db: Session,
    user: User,
    points: int,
    reason: str,
    reference_type: str = None,
    reference_id: UUID = None
):
    """
    Add points to user via PointHistory for audit trail.
    This creates a point history record and updates user level/streak.
    The caller is responsible for committing the transaction.
    """
    # Create point history record
    point_record = PointHistory(
        user_id=user.id,
        points=points,
        reason=reason,
        reference_type=reference_type,
        reference_id=reference_id
    )
    db.add(point_record)
    
    # Refresh user to get updated points from relationship
    db.flush()  # Ensure point_record is in session
    db.refresh(user)
    
    # Calculate Level based on total points
    old_level = user.level
    for level_data in LEVELS:
        if user.points >= level_data["minPoints"]:
            user.level = level_data["level"]
            user.level_name = level_data["name"]

    if user.level > old_level:
        from app.core.email import notify_level_up
        from app.core import friday
        notify_level_up(user.name, user.level, user.level_name, user.points)
        friday.tell(f"Level {user.level}: {user.level_name}", f"{user.points} XP")
    
    # Update Streak
    now = datetime.now(timezone.utc)
    today = now.date()
    
    if not user.updated_at or user.current_streak == 0:
        user.current_streak = 1
        user.longest_streak = max(1, user.longest_streak)
    else:
        last_active_date = user.updated_at.date()
        streak_before = user.current_streak

        off_days = load_off_days()
        if last_active_date == today:
            pass  # Already active today, streak unchanged
        elif streak_is_unbroken(last_active_date, today, off_days):
            user.current_streak += 1
        else:
            missed = missed_working_days(last_active_date, today, off_days)
            freezes = getattr(user, "streak_freezes", 0) or 0
            if 0 < missed <= freezes:
                user.streak_freezes = freezes - missed
                user.current_streak += 1
            else:
                user.current_streak = 1
        if user.current_streak != streak_before and user.current_streak % FREEZE_EVERY == 0:
            user.streak_freezes = min(FREEZE_CAP, (getattr(user, "streak_freezes", 0) or 0) + 1)
            
        # Update longest streak
        if user.current_streak > user.longest_streak:
            user.longest_streak = user.current_streak
    
    db.add(user)
    return user


# Legacy function for backward compatibility - deprecated
def update_user_stats(user: User, points_to_add: int):
    """
    DEPRECATED: Use add_points() instead.
    This function is kept for backward compatibility but doesn't create audit trail.
    """
    # This will be replaced in endpoint calls
    pass
