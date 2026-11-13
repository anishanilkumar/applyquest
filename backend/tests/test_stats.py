from datetime import date, datetime, timedelta, timezone
from types import SimpleNamespace

from app.core import nudges, stats
from app.models.application import ApplicationEffort, ApplicationStatus as S

# Thursday 2026-11-12, 19:30 Berlin.
NOW = datetime(2026, 11, 12, 18, 30, tzinfo=timezone.utc)
TODAY = date(2026, 11, 12)
n = 0


def app(status, applied=None, path=(), created_days_ago=1, source="LinkedIn", cover=None):
    global n
    n += 1
    applied = applied or TODAY
    history = [SimpleNamespace(old_status=path[i], new_status=s,
                               changed_at=datetime(2026, 11, 10, 9) + timedelta(hours=i))
               for i, s in enumerate(path[1:])]
    return SimpleNamespace(
        id=f"a{n}", status=status, applied_date=applied, history=history,
        created_at=(NOW - timedelta(days=created_days_ago)).replace(tzinfo=None),
        company_name=f"Co{n}", position_title="Engineer", job_url=f"https://jobs/{n}", priority_stars=3,
        job_board_source=source, effort=ApplicationEffort.FULL, cover_letter_file=cover,
    )


def user(deadline=date(2027, 3, 31), streak=5, active=False):
    return SimpleNamespace(
        current_streak=streak, longest_streak=9, level=3, level_name="Seeker", points=120,
        search_deadline=deadline, hiring_weeks=6, paperwork_weeks=4,
        updated_at=(NOW if active else NOW - timedelta(days=1)).replace(tzinfo=None),
    )


def test_counts_weeks_days_and_the_funnel():
    apps = [
        app(S.APPLIED, TODAY - timedelta(days=1)),
        app(S.APPLIED, TODAY - timedelta(days=3)),  # Monday: this week
        app(S.REJECTED, TODAY - timedelta(days=8), (S.APPLIED, S.REPLIED, S.REJECTED)),
        app(S.SHORTLISTED, created_days_ago=9),
        app(S.SHORTLISTED, created_days_ago=2),
    ]
    s = stats.summary(user(), apps, [], set(), NOW)
    assert s["today"] == {"date": "2026-11-12", "working": True, "sent": 0, "active": False}
    assert s["week"]["start"] == "2026-11-09"
    assert s["week"]["sent"] == 2
    assert s["weeks"][-2]["sent"] == 1
    assert len(s["weeks"]) == stats.WEEKS and len(s["days"]) == stats.DAYS
    assert s["days"][-1]["date"] == "2026-11-12"
    assert s["funnel"] == {"sent": 3, "replied": 1, "interviewed": 0, "offered": 0, "active": 2, "drafts": 2}
    assert [x["days"] for x in s["shortlist"]["oldest"]] == [9, 2]
    assert s["week"]["working_days_left"] == 2  # Thursday and Friday
    assert s["runway"]["last_apply_by"] == "2027-01-20"
    assert s["week"]["target"] >= 1
    assert s["recent"][0]["status"] == "Replied"


def test_no_deadline_means_no_runway_or_target():
    s = stats.summary(user(deadline=None), [app(S.APPLIED)], [], set(), NOW)
    assert s["runway"] is None and s["week"]["target"] is None


def test_evening_nudge_only_on_a_working_day_with_nothing_sent():
    drafts = [app(S.SHORTLISTED, created_days_ago=9), app(S.SHORTLISTED, created_days_ago=2)]
    s = stats.summary(user(), drafts, [], set(), NOW)
    title, body = nudges.evening(s)
    assert title == "Your 5-day streak ends tonight"
    assert body.startswith("2 shortlisted jobs waiting, the oldest for 9 days.")
    assert "This week: 0 of" in body

    assert nudges.evening(stats.summary(user(), [app(S.APPLIED)], [], set(), NOW)) is None
    assert nudges.evening(stats.summary(user(), drafts, [], {TODAY}, NOW)) is None
    active = nudges.evening(stats.summary(user(active=True), [], [], set(), NOW))
    assert active[0] == "No application sent today" and "shortlist is empty" in active[1]


def test_weekly_nudge_gives_the_runway():
    s = stats.summary(user(), [app(S.APPLIED, TODAY - timedelta(days=7))], [], set(), NOW)
    title, body = nudges.weekly(s)
    assert title.startswith("Last week: 1 sent, target ")
    assert "the chance of an offer by 3 Mar is" in body and "a week gets it to 80%" in body
    _, none = nudges.weekly(stats.summary(user(deadline=None), [], [], set(), NOW))
    assert "search deadline" in none


def test_good_news():
    assert nudges.good_news(S.REPLIED, "Acme", "Engineer") == ("Acme replied", "Engineer")
    assert nudges.good_news(S.PHONE_SCREEN, "Acme", "Engineer")[0] == "Phone Screen: Acme"
    assert nudges.good_news(S.REJECTED, "Acme", "Engineer") is None
