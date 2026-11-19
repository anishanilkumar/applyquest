import json
from datetime import date, timedelta
from pathlib import Path

_DATA_DIR = Path(__file__).parent.parent.parent / "data"
_HOLIDAY_FILES = [
    _DATA_DIR / "german_holidays.json",
    _DATA_DIR / "kerala_holidays.json",
]
_LEAVES_FILE = _DATA_DIR / "leaves.json"


def _parse_file(path: Path) -> set[date]:
    if not path.exists():
        return set()
    result: set[date] = set()
    for entry in json.loads(path.read_text()):
        if isinstance(entry, str):
            result.add(date.fromisoformat(entry))
        elif entry.get("enabled", True):
            result.add(date.fromisoformat(entry["date"]))
    return result


def load_off_days() -> set[date]:
    off_days: set[date] = set()
    for path in [*_HOLIDAY_FILES, _LEAVES_FILE]:
        off_days.update(_parse_file(path))
    return off_days


def _is_off_day(d: date, off_days: set[date]) -> bool:
    return d.weekday() >= 5 or d in off_days  # 5=Sat, 6=Sun


def streak_is_unbroken(last_date: date, today: date, off_days: set[date]) -> bool:
    """Returns True if every day strictly between last_date and today is an off-day."""
    for i in range(1, (today - last_date).days):
        if not _is_off_day(last_date + timedelta(days=i), off_days):
            return False
    return True


def missed_working_days(last_date: date, today: date, off_days: set[date]) -> int:
    """Working days strictly between last_date and today."""
    return sum(1 for i in range(1, (today - last_date).days)
               if not _is_off_day(last_date + timedelta(days=i), off_days))
