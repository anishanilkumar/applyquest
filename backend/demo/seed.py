#!/usr/bin/env python3
"""Wipe-and-reseed generator for the ApplyQuest demo instance.

Run against an *empty but migrated* `applyquest_demo` database — the reset unit
in apps.nix drops the database, recreates it, runs `alembic upgrade head` and
then runs this. It writes one demo user, ~55 applications with full status
histories, network contacts and a point history, then mints a login token and
renders boot.js (the auto-login + banner script nginx injects into the SPA).

It deliberately writes through the application's own SQLAlchemy models rather
than raw SQL, so it cannot drift from the schema, and it imports LEVELS from
app.core.gamification rather than restating the level thresholds.

Environment (all set by the unit):
    POSTGRES_*                  the demo database
    SECRET_KEY                  signs the injected token
    APPLYQUEST_DEMO_EMAIL       demo login (defaults to USER_EMAIL)
    APPLYQUEST_DEMO_PASSWORD    demo login password, shown in the banner
    APPLYQUEST_DEMO_MENTOR      mentor password, shown in the banner
    APPLYQUEST_DEMO_DATASET     path to dataset.toml
    APPLYQUEST_DEMO_TEMPLATE    path to boot.js.template
    APPLYQUEST_DEMO_WEB_DIR     where to write boot.js
"""

from __future__ import annotations

import json
import os
import random
import sys
import tomllib
from datetime import date, datetime, timedelta, timezone
from zoneinfo import ZoneInfo
from pathlib import Path

from app.core.config import settings
from app.core.gamification import LEVELS
from app.core.security import ACCESS_TOKEN_EXPIRE_MINUTES, create_access_token, get_password_hash
from app.db.session import SessionLocal
from app.models.application import Application, ApplicationEffort, ApplicationHistory, ApplicationStatus, GermanLevel
from app.models.interview import Interview
from app.models.network import NetworkContact
from app.models.point_history import PointHistory
from app.models.user import User

S = ApplicationStatus

HERE = Path(__file__).resolve().parent
DATASET = Path(os.environ.get("APPLYQUEST_DEMO_DATASET", HERE / "dataset.toml"))
TEMPLATE = Path(os.environ.get("APPLYQUEST_DEMO_TEMPLATE", HERE / "boot.js.template"))
WEB_DIR = Path(os.environ.get("APPLYQUEST_DEMO_WEB_DIR", "/var/lib/applyquest-demo/web"))

DEMO_EMAIL = os.environ.get("APPLYQUEST_DEMO_EMAIL") or settings.USER_EMAIL
DEMO_PASSWORD = os.environ.get("APPLYQUEST_DEMO_PASSWORD", "demo1234")
MENTOR_PASSWORD = os.environ.get("APPLYQUEST_DEMO_MENTOR", settings.SHARE_PASSWORD)

# The search runs over roughly four months, which is long enough for the
# timeline chart to show shape and short enough that everything still reads as
# an active search rather than an archive.
SEARCH_DAYS = 130

# How each application walked the funnel. The transition map in
# endpoints/applications.py is strictly linear, so a path is just the list of
# statuses it passed through; every application enters at Shortlisted, which
# gives the Sankey a single source instead of a spray of entry points.
#
# The counts add up to a plausible search: a lot of silence, a handful of
# processes that went somewhere, one offer. Uniformly-distributed statuses look
# obviously synthetic on the analytics page.
PATH_PLAN: list[tuple[int, list[ApplicationStatus]]] = [
    (5,  [S.SHORTLISTED]),
    (9,  [S.SHORTLISTED, S.APPLIED]),
    (12, [S.SHORTLISTED, S.APPLIED, S.REJECTED]),
    (6,  [S.SHORTLISTED, S.APPLIED, S.GHOSTED]),
    (3,  [S.SHORTLISTED, S.APPLIED, S.REPLIED]),
    (3,  [S.SHORTLISTED, S.APPLIED, S.REPLIED, S.REJECTED]),
    (2,  [S.SHORTLISTED, S.APPLIED, S.REPLIED, S.GHOSTED]),
    (2,  [S.SHORTLISTED, S.APPLIED, S.REPLIED, S.PHONE_SCREEN]),
    (3,  [S.SHORTLISTED, S.APPLIED, S.REPLIED, S.PHONE_SCREEN, S.REJECTED]),
    (1,  [S.SHORTLISTED, S.APPLIED, S.REPLIED, S.PHONE_SCREEN, S.GHOSTED]),
    (2,  [S.SHORTLISTED, S.APPLIED, S.REPLIED, S.PHONE_SCREEN, S.TECHNICAL_ROUND_1]),
    (2,  [S.SHORTLISTED, S.APPLIED, S.REPLIED, S.PHONE_SCREEN, S.TECHNICAL_ROUND_1, S.REJECTED]),
    (1,  [S.SHORTLISTED, S.APPLIED, S.REPLIED, S.PHONE_SCREEN, S.TECHNICAL_ROUND_1, S.TECHNICAL_ROUND_2]),
    (1,  [S.SHORTLISTED, S.APPLIED, S.REPLIED, S.PHONE_SCREEN, S.TECHNICAL_ROUND_1, S.TECHNICAL_ROUND_2, S.REJECTED]),
    (1,  [S.SHORTLISTED, S.APPLIED, S.REPLIED, S.PHONE_SCREEN, S.TECHNICAL_ROUND_1, S.TECHNICAL_ROUND_2, S.FINAL_ROUND]),
    (1,  [S.SHORTLISTED, S.APPLIED, S.REPLIED, S.PHONE_SCREEN, S.TECHNICAL_ROUND_1, S.TECHNICAL_ROUND_2, S.FINAL_ROUND, S.REJECTED]),
    (1,  [S.SHORTLISTED, S.APPLIED, S.REPLIED, S.PHONE_SCREEN, S.TECHNICAL_ROUND_1, S.TECHNICAL_ROUND_2, S.FINAL_ROUND, S.OFFER]),
]

# Days between one status and the next, as (min, max). Rejections and ghosting
# take longer than progress does, which is what makes a real pipeline feel slow.
GAPS: dict[ApplicationStatus, tuple[int, int]] = {
    S.APPLIED: (0, 6),
    S.REPLIED: (2, 14),
    S.PHONE_SCREEN: (3, 10),
    S.TECHNICAL_ROUND_1: (4, 12),
    S.TECHNICAL_ROUND_2: (4, 12),
    S.FINAL_ROUND: (5, 14),
    S.OFFER: (2, 9),
    S.REJECTED: (5, 28),
    S.GHOSTED: (21, 45),
}

# Interviews. Every interview stage an application reached gets the
# conversation that put it there, on that stage's date; an application whose
# process is still running gets its next conversation booked a few days ahead,
# so the calendar and the Dashboard always have something coming up.
INTERVIEW_STAGES = [S.PHONE_SCREEN, S.TECHNICAL_ROUND_1, S.TECHNICAL_ROUND_2, S.FINAL_ROUND]
NEXT_STAGE = {
    S.APPLIED: None, S.REPLIED: S.PHONE_SCREEN, S.PHONE_SCREEN: S.TECHNICAL_ROUND_1,
    S.TECHNICAL_ROUND_1: S.TECHNICAL_ROUND_2, S.TECHNICAL_ROUND_2: S.FINAL_ROUND, S.FINAL_ROUND: None,
}
# (title, minutes, interviewer roles) per stage.
INTERVIEW_SHAPE = {
    S.PHONE_SCREEN: (["Intro call", "Talent Talk", "Recruiter screen"], 30,
                     ["Talent Acquisition Partner", "Senior Recruiter", "Head of Talent"]),
    S.TECHNICAL_ROUND_1: (["Technical interview", "Live coding", "Take-home review"], 60,
                          ["Senior Engineer", "Staff Engineer", "Engineering Manager"]),
    S.TECHNICAL_ROUND_2: (["System design", "Architecture deep-dive"], 90,
                          ["Principal Engineer", "Engineering Manager", "Tech Lead"]),
    S.FINAL_ROUND: (["Final round", "Culture and values", "Meet the team"], 120,
                    ["Head of Engineering", "CTO", "VP Engineering"]),
}
FIRST_NAMES = ["Lena", "Jonas", "Mira", "Felix", "Sara", "Niklas", "Hannah", "David", "Emma", "Lukas", "Aylin", "Mateo"]
LAST_NAMES = ["Hoffmann", "Becker", "Schulz", "Yilmaz", "Wagner", "Novak", "Richter", "Okafor", "Lindqvist", "Brandt"]
BERLIN = ZoneInfo("Europe/Berlin")

# Which note pool a status draws from.
NOTE_POOL = {
    S.SHORTLISTED: "shortlisted",
    S.APPLIED: "applied",
    S.REPLIED: "replied",
    S.PHONE_SCREEN: "interview",
    S.TECHNICAL_ROUND_1: "interview",
    S.TECHNICAL_ROUND_2: "interview",
    S.FINAL_ROUND: "interview",
    S.OFFER: "offer",
    S.REJECTED: "rejected",
    S.GHOSTED: "ghosted",
}

# Notes attached to the history row for a transition, so the timeline reads as
# a narrative rather than a list of bare status names.
HISTORY_NOTES = {
    S.APPLIED: ["Application submitted.", "Sent via {source}.", "Applied with a tailored CV."],
    S.REPLIED: ["Recruiter got back to me.", "Reply came in — they want to talk.", "First response received."],
    S.PHONE_SCREEN: ["Intro call scheduled.", "30 min screen with the recruiter.", "Phone screen booked."],
    S.TECHNICAL_ROUND_1: ["First technical interview.", "Coding round scheduled.", "Take-home reviewed, moving on."],
    S.TECHNICAL_ROUND_2: ["System design round.", "Second technical with the team.", "Pairing session booked."],
    S.FINAL_ROUND: ["Final round with the hiring manager.", "On-site scheduled.", "Last stage — meeting the team."],
    S.OFFER: ["Offer received."],
    S.REJECTED: ["Rejection email received.", "Not moving forward.", "Position filled elsewhere."],
    S.GHOSTED: ["No response after repeated follow-ups.", "Marking as ghosted.", "Went quiet — writing it off."],
}


def is_workday(d: date) -> bool:
    return d.weekday() < 5


def working_days_back(anchor: date, count: int) -> list[date]:
    """The `count` most recent working days at or before `anchor`, oldest first."""
    days: list[date] = []
    cursor = anchor
    while len(days) < count:
        if is_workday(cursor):
            days.append(cursor)
        cursor -= timedelta(days=1)
    return list(reversed(days))


def weighted_choice(rng: random.Random, items: list[dict], key: str = "weight"):
    total = sum(i[key] for i in items)
    roll = rng.uniform(0, total)
    running = 0.0
    for item in items:
        running += item[key]
        if roll <= running:
            return item
    return items[-1]


def pick_effort(rng: random.Random, source: dict) -> ApplicationEffort:
    # Generic at the source's rate; the rest are mostly tailored, with a few
    # left unclassified the way real data accumulates them.
    if rng.random() < source["generic_rate"]:
        return ApplicationEffort.GENERIC
    return rng.choices(
        [ApplicationEffort.FULL, ApplicationEffort.LIGHT, ApplicationEffort.UNKNOWN],
        weights=[45, 40, 15],
    )[0]


def role_type_for(title: str) -> str:
    t = title.lower()
    if "full stack" in t:
        return "Fullstack"
    if "data" in t:
        return "Data"
    if any(k in t for k in ("platform", "reliability", "devops")):
        return "DevOps"
    return "Backend"


def fit_score_for(rng: random.Random, path: list) -> int:
    """Postings that went further tended to fit better, but not always."""
    reached = sum(1 for s in path if s in INTERVIEW_STAGES or s == S.REPLIED)
    return max(25, min(95, round(rng.gauss(58 + 5 * reached, 10))))


def seed_interviews(db, rng: random.Random, app, stamps, today: date, taken: set) -> None:
    """`taken` holds booked (day, hour, minute) slots: one person, one interview at a time."""
    def panel(stage, size):
        roles = rng.sample(INTERVIEW_SHAPE[stage][2], size)
        return ", ".join(f"{rng.choice(FIRST_NAMES)} {rng.choice(LAST_NAMES)} ({role})" for role in roles)

    def book(stage, day: date, upcoming: bool):
        titles, minutes, _ = INTERVIEW_SHAPE[stage]
        while day.weekday() >= 5:
            day += timedelta(days=1)
        slots = [(h, m) for h in (9, 10, 11, 13, 14, 15, 16) for m in (0, 30)]
        rng.shuffle(slots)
        hour, minute = next(((h, m) for h, m in slots if (day, h, m) not in taken), slots[0])
        taken.add((day, hour, minute))
        start = datetime.combine(day, datetime.min.time(), BERLIN).replace(hour=hour, minute=minute)
        people = panel(stage, 1 if stage == S.PHONE_SCREEN else rng.randint(1, 2))
        db.add(Interview(
            application_id=app.id,
            starts_at=start,
            ends_at=start + timedelta(minutes=minutes),
            stage=stage.value,
            title=rng.choice(titles),
            meeting_url=f"https://meet.example.com/{''.join(rng.choices('abcdefghjkmnpqrstuvwxyz', k=3))}-{''.join(rng.choices('abcdefghjkmnpqrstuvwxyz', k=4))}",
            interviewers=people,
            notes=None if upcoming else rng.choice([None, "Went well — follow-up questions on scaling.", "Mostly about past projects.", "Asked about notice period and salary range."]),
        ))

    for stage, day in stamps:
        if stage in INTERVIEW_STAGES:
            # Invited on the stage date; the conversation itself a few days on,
            # unless that would put a finished stage in the future.
            held = min(day + timedelta(days=rng.randint(1, 4)), today - timedelta(days=1))
            if stage == stamps[-1][0] and app.status not in (S.REJECTED, S.GHOSTED):
                continue  # the current stage is booked ahead below
            book(stage, max(held, day), upcoming=False)

    current = app.status
    if current in INTERVIEW_STAGES:
        book(current, today + timedelta(days=rng.randint(1, 9)), upcoming=True)
    elif NEXT_STAGE.get(current) and rng.random() < 0.6:
        book(NEXT_STAGE[current], today + timedelta(days=rng.randint(2, 12)), upcoming=True)


def level_for(points: int) -> tuple[int, str]:
    level, name = LEVELS[0]["level"], LEVELS[0]["name"]
    for entry in LEVELS:
        if points >= entry["minPoints"]:
            level, name = entry["level"], entry["name"]
    return level, name


def build(db, rng: random.Random, data: dict, today: date) -> dict:
    user = User(
        name="Alex Rivera",
        email=DEMO_EMAIL,
        hashed_password=get_password_hash(DEMO_PASSWORD),
        current_education="M.Sc. Computer Science",
        german_level="B1",
        current_role="Backend Engineer",
        level=1,
        level_name="Novice Seeker",
        current_streak=0,
        longest_streak=0,
        # Runway card: a search window that ends about five months out, so the
        # odds and the pace it needs are both visible on the Dashboard.
        search_deadline=today + timedelta(days=165),
        hiring_weeks=6,
        paperwork_weeks=4,
    )
    db.add(user)
    db.flush()

    companies = list(data["companies"])
    rng.shuffle(companies)
    sources = data["sources"]
    titles = data["titles"]
    notes = data["notes"]

    # Expand the plan into one path per application, then shuffle so the
    # interesting ones are not all clustered at the same point in time.
    paths: list[list[ApplicationStatus]] = []
    for count, path in PATH_PLAN:
        paths.extend([list(path) for _ in range(count)])
    rng.shuffle(paths)

    point_rows: list[tuple[int, str, str, object, datetime]] = []
    applications: list[Application] = []
    booked: set = set()

    for index, path in enumerate(paths):
        company = companies[index % len(companies)]
        source = weighted_choice(rng, sources)
        title = rng.choice(titles)
        stack_pool = company["stack"]
        stack = ", ".join(rng.sample(stack_pool, min(len(stack_pool), rng.randint(2, 4))))

        remote = company.get("remote", False) and rng.random() < 0.3
        location = "Remote (Germany)" if remote else company["city"]

        # Walk the path forward from a start date far enough back that the whole
        # chain lands on or before today. How far back depends on where it
        # ended up: something still sitting in Shortlisted was saved this week,
        # not four months ago, and a still-unanswered Applied would have been
        # written off as ghosted by now if it were old.
        span = sum(GAPS[s][1] for s in path[1:])
        final_status = path[-1]
        if final_status is S.SHORTLISTED:
            low, high = 1, 21
        elif final_status is S.APPLIED:
            low, high = 4, 45
        elif final_status in (S.REJECTED, S.GHOSTED):
            low, high = span + 2, SEARCH_DAYS
        else:
            low, high = span + 2, min(span + 40, SEARCH_DAYS)
        cursor = today - timedelta(days=rng.randint(min(low, high), high))

        stamps: list[tuple[ApplicationStatus, date]] = [(path[0], cursor)]
        for status in path[1:]:
            low, high = GAPS[status]
            cursor = cursor + timedelta(days=rng.randint(low, high))
            if cursor > today:
                cursor = today
            stamps.append((status, cursor))

        applied_on = next((d for s, d in stamps if s == S.APPLIED), stamps[0][1])

        note_template = rng.choice(notes[NOTE_POOL[final_status]])
        note = note_template.format(
            company=company["name"],
            title=title,
            source=source["name"],
            stack=stack_pool[0],
        )

        german = rng.choices(
            [GermanLevel.NONE, GermanLevel.BASIC, GermanLevel.FLUENT],
            weights=[62, 28, 10],
        )[0]

        effort = pick_effort(rng, source)
        folder = archive_name(company["name"], title)
        # The ai-job-search fields: a drafted application carries its fit score
        # and the names of its documents; one never classified carries none.
        drafted = effort is not ApplicationEffort.UNKNOWN
        app = Application(
            user_id=user.id,
            company_name=company["name"],
            position_title=title,
            location=location,
            job_url=f"https://careers.{slug(company['name'])}.example/jobs/{rng.randint(10000, 99999)}",
            salary_range=company["band"],
            tech_stack=stack,
            status=final_status,
            visa_sponsorship=rng.random() < 0.55,
            german_requirement=german,
            relocation_support=rng.random() < 0.35,
            effort=effort,
            fit_score=fit_score_for(rng, path) if drafted else None,
            role_type=role_type_for(title),
            cv_file=(f"cv/generic/main_generic_{role_type_for(title).lower()}.tex" if effort is ApplicationEffort.GENERIC
                     else f"cv/main_{folder}.tex") if drafted else None,
            cover_letter_file=f"cover_letters/cover_{folder}.tex" if effort is ApplicationEffort.FULL else None,
            research_file=f"company_research/{slug(company['name'])}.json" if effort is ApplicationEffort.FULL else None,
            archive_dir=folder if drafted else None,
            job_board_source=source["name"],
            priority_stars=rng.choices([0, 1, 2, 3, 4, 5], weights=[18, 14, 20, 22, 16, 10])[0],
            notes=note,
            applied_date=applied_on,
            created_at=as_dt(stamps[0][1], rng),
            updated_at=as_dt(stamps[-1][1], rng),
        )
        db.add(app)
        db.flush()
        applications.append(app)

        # +2 the moment it was created, exactly as endpoints/applications.py does.
        point_rows.append((2, "Created application", "application", app.id, app.created_at))

        previous = path[0]
        for status, when in stamps[1:]:
            db.add(
                ApplicationHistory(
                    application_id=app.id,
                    old_status=previous,
                    new_status=status,
                    changed_at=as_dt(when, rng),
                    notes=rng.choice(HISTORY_NOTES[status]).format(source=source["name"]),
                )
            )
            previous = status

        seed_interviews(db, rng, app, stamps, today, booked)

        # Status changes award nothing, but editing an application does (+1).
        # A third of them picked up an edit somewhere along the way.
        if rng.random() < 0.33:
            point_rows.append(
                (1, "Updated application", "application", app.id, as_dt(stamps[-1][1], rng))
            )

    # Fail the reset rather than ship a map with holes in it: a company added
    # to dataset.toml with a city missing from [coordinates] would otherwise
    # silently fall back to a Nominatim lookup that gets rate-limited away.
    missing = sorted({a.location.lower() for a in applications} - set(data["coordinates"]))
    if missing:
        raise SystemExit(f"dataset.toml [coordinates] is missing: {', '.join(missing)}")

    contacts = seed_contacts(db, rng, user, data, applications, today, point_rows)
    total_points = seed_points(db, rng, user, point_rows, today)

    user.level, user.level_name = level_for(total_points)
    # A live-looking streak: seven working days running, and a better run earlier
    # in the search. updated_at is now, so the daily reminder job sees activity
    # today and the dashboard does not show the streak as already broken.
    user.current_streak = 7
    user.longest_streak = 19
    user.updated_at = datetime.now(timezone.utc).replace(tzinfo=None)
    db.add(user)
    db.commit()

    return {
        "user": user,
        "applications": len(applications),
        "contacts": len(contacts),
        "points": total_points,
        # Only the locations actually used, keyed and shaped exactly as
        # GermanyMap.tsx writes them: localStorage["geocode_<lower>"] = "[lat,lon]".
        "geocode": {
            loc.lower(): data["coordinates"][loc.lower()]
            for loc in {a.location for a in applications}
        },
    }


def slug(name: str) -> str:
    return "".join(c.lower() for c in name if c.isalnum())


def archive_name(*parts: str) -> str:
    """ai-job-search's archive folder rule: lowercase words joined by underscores."""
    words = " ".join(parts).lower().split()
    return "_".join(w for w in ("".join(c for c in word if c.isalnum()) for word in words) if w)


def as_dt(d: date, rng: random.Random) -> datetime:
    """A date turned into a plausible working-hours timestamp."""
    return datetime(d.year, d.month, d.day, rng.randint(8, 20), rng.randint(0, 59))


def seed_contacts(db, rng, user, data, applications, today, point_rows) -> list[NetworkContact]:
    """Network contacts, some tied to an application, two of them as referrals."""
    contacts: list[NetworkContact] = []
    # Only attach contacts to applications that actually went somewhere — a
    # contact on a never-answered application is noise.
    engaged = [a for a in applications if a.status not in (S.SHORTLISTED, S.APPLIED)]
    rng.shuffle(engaged)

    created_at: dict[str, datetime] = {}
    for index, spec in enumerate(data["contacts"]):
        linked = engaged[index] if index < len(engaged) else None
        company = linked.company_name if linked else rng.choice(data["companies"])["name"]
        created = as_dt(today - timedelta(days=rng.randint(5, SEARCH_DAYS)), rng)

        contact = NetworkContact(
            user_id=user.id,
            name=spec["name"],
            email=f"{slug(spec['name'])}@{slug(company)}.example",
            company=company,
            relationship_type=spec["relationship_type"],
            connection_strength=spec["strength"],
            last_contact_date=today - timedelta(days=rng.randint(2, 60)),
            notes=spec["note"],
            application_id=linked.id if linked else None,
            created_at=created,
            updated_at=created,
        )
        db.add(contact)
        contacts.append(contact)
        created_at[spec["name"]] = created

    # Flushed before the point rows are written so every row can carry the real
    # contact id rather than a placeholder to be patched up afterwards.
    db.flush()

    for contact in contacts:
        point_rows.append(
            (1, "Added network contact", "network_contact", contact.id, created_at[contact.name])
        )

    # A handful were revisited later, which is what the +1 update award covers.
    for contact in rng.sample(contacts, 5):
        point_rows.append(
            (
                1,
                "Updated network contact",
                "network_contact",
                contact.id,
                as_dt(today - timedelta(days=rng.randint(1, 30)), rng),
            )
        )

    # Two applications came through a referral.
    for contact in [c for c in contacts if c.application_id is not None][:2]:
        app = next(a for a in applications if a.id == contact.application_id)
        app.referral_contact_id = contact.id
        db.add(app)

    return contacts


def seed_points(db, rng, user, point_rows, today) -> int:
    """Write the point history, including the daily goal bonuses.

    The award values here are the real ones from the endpoints (+2 create, +1
    update, +1 contact) — status changes award nothing at all, so
    the 25-point daily goal bonus is the only thing that moves the level bar in
    a meaningful way. Twenty-four of them over four months is what puts this
    account at level 4 rather than stuck at level 1 with a full pipeline.
    """
    # The most recent seven working days are consecutive, matching
    # current_streak = 7. The rest are scattered further back.
    recent = working_days_back(today - timedelta(days=1), 7)
    pool = [d for d in working_days_back(today - timedelta(days=1), 70) if d not in recent]
    bonus_days = sorted(rng.sample(pool, 17)) + recent

    for day in bonus_days:
        point_rows.append((25, "Daily goal bonus", None, None, datetime(day.year, day.month, day.day, 21, 30)))

    for points, reason, ref_type, ref_id, when in point_rows:
        db.add(
            PointHistory(
                user_id=user.id,
                points=points,
                reason=reason,
                reference_type=ref_type,
                reference_id=ref_id,
                created_at=when,
            )
        )

    # Yesterday, not today — so a visitor can still claim today's bonus and
    # watch the points move.
    user.last_goal_bonus_date = bonus_days[-1]
    return sum(p for p, _, _, _, _ in point_rows)


def write_boot_js(user, reset_at: datetime, geocode: dict) -> Path:
    """Render the auto-login + banner script nginx injects into index.html."""
    token = create_access_token(user.id, expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    rendered = (
        TEMPLATE.read_text()
        .replace("__TOKEN__", token)
        .replace("__EMAIL__", DEMO_EMAIL)
        .replace("__PASSWORD__", DEMO_PASSWORD)
        .replace("__MENTOR__", MENTOR_PASSWORD)
        .replace("__RESET_AT__", reset_at.strftime("%d %b %Y, %H:%M UTC"))
        # ensure_ascii, so "düsseldorf" ships as a \u escape. nginx serves .js
        # with no charset, leaving the browser to inherit the document's — true
        # here, but an escape sequence cannot be got wrong either way.
        .replace('"__GEOCODE__"', json.dumps(geocode, sort_keys=True))
    )
    WEB_DIR.mkdir(parents=True, exist_ok=True)
    target = WEB_DIR / "boot.js"
    tmp = WEB_DIR / "boot.js.tmp"
    tmp.write_text(rendered)
    tmp.replace(target)  # atomic, so nginx never serves a half-written file
    return target


def main() -> int:
    if settings.POSTGRES_DB == "applyquest":
        print("refusing to seed: POSTGRES_DB is the production database", file=sys.stderr)
        return 1

    now = datetime.now(timezone.utc).replace(tzinfo=None)
    today = now.date()
    # Seeded from the reset date: every reset produces a different dataset, but
    # any one reset can be reproduced exactly when something looks wrong.
    rng = random.Random(today.toordinal())

    data = tomllib.loads(DATASET.read_text())

    db = SessionLocal()
    try:
        if db.query(User).count():
            print("refusing to seed: database is not empty", file=sys.stderr)
            return 1
        result = build(db, rng, data, today)
        target = write_boot_js(result["user"], now, result["geocode"])
    finally:
        db.close()

    print(
        json.dumps(
            {
                "database": settings.POSTGRES_DB,
                "user": DEMO_EMAIL,
                "applications": result["applications"],
                "contacts": result["contacts"],
                "points": result["points"],
                "level": f"{result['user'].level} {result['user'].level_name}",
                "geocoded_locations": len(result["geocode"]),
                "boot_js": str(target),
            },
            indent=2,
        )
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
