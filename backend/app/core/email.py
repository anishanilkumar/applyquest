import logging
import threading
from typing import Optional

import resend

from app.core.config import settings

logger = logging.getLogger(__name__)


def _mentor_emails() -> list[str]:
    if not settings.MENTOR_EMAILS:
        return []
    return [e.strip() for e in settings.MENTOR_EMAILS.split(",") if e.strip()]


def _send(to: list[str], subject: str, html: str) -> None:
    if not settings.RESEND_API_KEY:
        logger.warning("RESEND_API_KEY not set, skipping: %s", subject)
        return
    if not to:
        return

    def _do():
        try:
            resend.api_key = settings.RESEND_API_KEY
            resend.Emails.send({
                "from": settings.EMAIL_FROM,
                "to": to,
                "reply_to": settings.USER_EMAIL,
                "subject": subject,
                "html": html,
            })
        except Exception:
            logger.exception("Failed to send email: %s", subject)

    threading.Thread(target=_do).start()


# --- Triggered notifications ---

def notify_level_up(user_name: str, level: int, level_name: str, points: int) -> None:
    html = f"""
    <h2>Level Up! 🎉</h2>
    <p>You've reached <strong>Level {level}: {level_name}</strong> with {points} total points.</p>
    <p>Keep going — you're making real progress!</p>
    """
    _send([settings.USER_EMAIL], f"Level Up! You're now {level_name}", html)


def notify_milestone(user_name: str, count: int) -> None:
    user_html = f"""
    <h2>{count} Applications! 🏆</h2>
    <p>You just submitted your <strong>{count}th application</strong>. That's a real milestone.</p>
    <p>Every application gets you closer. Keep the momentum going!</p>
    """
    mentor_html = f"""
    <h2>{user_name} hit {count} applications 🏆</h2>
    <p><strong>{user_name}</strong> just submitted their <strong>{count}th job application</strong>.</p>
    <p>That's serious dedication.</p>
    """
    _send([settings.USER_EMAIL], f"Milestone: {count} applications submitted!", user_html)
    _send(_mentor_emails(), f"{user_name} hit {count} applications!", mentor_html)


def notify_interview(user_name: str, company: str, position: str, status: str, notes: Optional[str] = None) -> None:
    notes_line = f"<p><em>Notes: {notes}</em></p>" if notes else ""
    user_html = f"""
    <h2>Interview Stage: {status} 🎯</h2>
    <p>Your application to <strong>{company}</strong> for <strong>{position}</strong>
    has moved to <strong>{status}</strong>.</p>
    {notes_line}
    <p>Good luck — you've earned this!</p>
    """
    mentor_html = f"""
    <h2>{user_name} has an interview! 🎯</h2>
    <p><strong>Company:</strong> {company}<br>
    <strong>Position:</strong> {position}<br>
    <strong>Stage:</strong> {status}</p>
    {notes_line}
    """
    _send([settings.USER_EMAIL], f"Interview: {status} at {company}", user_html)
    _send(_mentor_emails(), f"{user_name} — {status} at {company}", mentor_html)


def notify_offer(user_name: str, company: str, position: str, location: str, salary_range: Optional[str], notes: Optional[str] = None) -> None:
    salary_line = f"<p><strong>Salary:</strong> {salary_range}</p>" if salary_range else ""
    notes_line = f"<p><em>Notes: {notes}</em></p>" if notes else ""
    user_html = f"""
    <h2>You got an offer! 🎉🎉🎉</h2>
    <p><strong>{company}</strong> has extended an offer for <strong>{position}</strong> in {location}.</p>
    {salary_line}
    {notes_line}
    <p>Take your time, evaluate carefully, and celebrate!</p>
    """
    mentor_html = f"""
    <h2>{user_name} received an offer! 🎉</h2>
    <p><strong>Company:</strong> {company}<br>
    <strong>Position:</strong> {position}<br>
    <strong>Location:</strong> {location}</p>
    {salary_line}
    {notes_line}
    <p>Reach out to discuss the details!</p>
    """
    _send([settings.USER_EMAIL], f"Offer received from {company}! 🎉", user_html)
    _send(_mentor_emails(), f"{user_name} got an offer from {company}!", mentor_html)


# --- Scheduled notifications ---

def notify_daily_reminder(user_name: str, streak: int) -> None:
    streak_line = (
        f"<p>⚠️ You have a <strong>{streak}-day streak</strong> — don't break it now!</p>"
        if streak > 3 else ""
    )
    html = f"""
    <h2>Daily Reminder 🔔</h2>
    <p>Hey {user_name}, you haven't logged any job activity today.</p>
    {streak_line}
    <p>Even one application or a status update keeps the momentum going.</p>
    """
    _send([settings.USER_EMAIL], "Don't forget to apply today!", html)


def notify_streak_broken(user_name: str, streak: int) -> None:
    html = f"""
    <h2>Streak broken 😔</h2>
    <p>Your <strong>{streak}-day streak</strong> was not maintained yesterday.</p>
    <p>Keep going — you can rebuild it today!</p>
    """
    _send([settings.USER_EMAIL], "Your streak was broken", html)


def notify_weekly_summary(
    user_name: str,
    current_streak: int,
    longest_streak: int,
    level: int,
    level_name: str,
    points: int,
    total_apps: int,
    apps_this_week: int,
    response_rate: int,
    interview_rate: int,
    active_apps: int,
    followup_needed: int = 0,
    decision_needed: int = 0,
) -> None:
    def row(label, value):
        return f"<tr><td style='padding:8px;border:1px solid #ddd'><strong>{label}</strong></td><td style='padding:8px;border:1px solid #ddd'>{value}</td></tr>"

    followup_row = ""
    if followup_needed or decision_needed:
        followup_row = row("Followup needed", f"{followup_needed} pending · {decision_needed} need a decision")

    html = f"""
    <h2>Weekly Summary — {user_name} 📊</h2>
    <table style="border-collapse:collapse;width:100%;font-family:sans-serif">
        {row("Applications this week", apps_this_week)}
        {row("Total applications", total_apps)}
        {row("Active applications", active_apps)}
        {row("Response rate", f"{response_rate}%")}
        {row("Interview rate", f"{interview_rate}%")}
        {followup_row}
        {row("Current streak", f"{current_streak} days")}
        {row("Longest streak", f"{longest_streak} days")}
        {row("Level", f"Level {level}: {level_name}")}
        {row("Total points", points)}
    </table>
    """
    recipients = [settings.USER_EMAIL] + _mentor_emails()
    _send(recipients, f"Weekly update: {user_name}'s job search", html)


def notify_followup_digest(
    user_name: str,
    needs_followup: list,
    needs_decision: list,
) -> None:
    def app_row(item):
        return (
            f"<tr>"
            f"<td style='padding:8px;border:1px solid #ddd'>{item['company']}</td>"
            f"<td style='padding:8px;border:1px solid #ddd'>{item['position']}</td>"
            f"<td style='padding:8px;border:1px solid #ddd'>{item['status']}</td>"
            f"<td style='padding:8px;border:1px solid #ddd'>{item['days_stale']} days</td>"
            f"</tr>"
        )

    def decision_row(item):
        return (
            f"<tr>"
            f"<td style='padding:8px;border:1px solid #ddd'>{item['company']}</td>"
            f"<td style='padding:8px;border:1px solid #ddd'>{item['position']}</td>"
            f"<td style='padding:8px;border:1px solid #ddd'>{item['followed_up_days_ago']} days ago</td>"
            f"</tr>"
        )

    followup_section = ""
    if needs_followup:
        rows = "".join(app_row(i) for i in needs_followup)
        followup_section = f"""
        <h3 style="color:#d97706">⏰ Needs Followup ({len(needs_followup)})</h3>
        <table style="border-collapse:collapse;width:100%;font-family:sans-serif">
            <tr style="background:#fef3c7">
                <th style="padding:8px;border:1px solid #ddd;text-align:left">Company</th>
                <th style="padding:8px;border:1px solid #ddd;text-align:left">Position</th>
                <th style="padding:8px;border:1px solid #ddd;text-align:left">Status</th>
                <th style="padding:8px;border:1px solid #ddd;text-align:left">Stale</th>
            </tr>
            {rows}
        </table>
        """

    decision_section = ""
    if needs_decision:
        rows = "".join(decision_row(i) for i in needs_decision)
        decision_section = f"""
        <h3 style="color:#dc2626">🔴 Needs Decision ({len(needs_decision)})</h3>
        <p style="color:#6b7280;font-size:14px">You followed up on these — time to mark them Ghosted, Rejected, or advance to the next round.</p>
        <table style="border-collapse:collapse;width:100%;font-family:sans-serif">
            <tr style="background:#fee2e2">
                <th style="padding:8px;border:1px solid #ddd;text-align:left">Company</th>
                <th style="padding:8px;border:1px solid #ddd;text-align:left">Position</th>
                <th style="padding:8px;border:1px solid #ddd;text-align:left">Followed up</th>
            </tr>
            {rows}
        </table>
        """

    html = f"""
    <h2>Followup Queue — {user_name} 🔔</h2>
    {followup_section}
    {decision_section}
    <p style="color:#6b7280;font-size:13px;margin-top:16px">Visit the Followup Queue in ApplyQuest to take action.</p>
    """
    _send([settings.USER_EMAIL], "Followup Queue — applications need your attention", html)
