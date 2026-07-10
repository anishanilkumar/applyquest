"""
ApplyQuest MCP server.

Exposes a small set of agent-friendly tools over the ApplyQuest REST API so that
Claude (e.g. with the Gmail connector enabled) can reconcile your inbox with your
tracked applications: find a job, mark it Applied/Rejected, or create it with the
job details pulled from an email.

This is a thin client — it just calls the running backend with the static API key,
so all status-transition rules, history records, gamification and notification
emails happen exactly as they do for the web UI.

Run (stdio transport, launched by your MCP client):

    APPLYQUEST_API_KEY=... backend/.venv/bin/python backend/mcp_server.py

Environment:
    APPLYQUEST_API_KEY   (required) must match settings.APPLYQUEST_API_KEY on the backend
    APPLYQUEST_API_BASE  (optional) defaults to http://localhost:8000/api/v1
"""
import os
from datetime import date
from typing import Any, Optional

import httpx
from mcp.server.fastmcp import FastMCP

API_BASE = os.environ.get("APPLYQUEST_API_BASE", "http://localhost:8000/api/v1").rstrip("/")
API_KEY = os.environ.get("APPLYQUEST_API_KEY", "")

# The full set of statuses the backend accepts, in pipeline order. Only some
# transitions are legal (see mark_status docstring).
VALID_STATUSES = [
    "Shortlisted", "Applied", "Replied", "Phone Screen",
    "Technical Round 1", "Technical Round 2", "Final Round",
    "Offer", "Rejected", "Ghosted",
]

mcp = FastMCP("applyquest")


def _client() -> httpx.Client:
    if not API_KEY:
        raise RuntimeError("APPLYQUEST_API_KEY is not set in the MCP server environment.")
    return httpx.Client(
        base_url=API_BASE,
        headers={"X-API-Key": API_KEY},
        timeout=30.0,
    )


def _err(resp: httpx.Response) -> dict:
    """Surface the backend's error detail so Claude can react (e.g. illegal transition)."""
    try:
        detail = resp.json().get("detail", resp.text)
    except Exception:
        detail = resp.text
    return {"error": f"HTTP {resp.status_code}", "detail": detail}


def _trim(app: dict) -> dict:
    """Compact view of an application for listings."""
    return {
        "id": app.get("id"),
        "company_name": app.get("company_name"),
        "position_title": app.get("position_title"),
        "location": app.get("location"),
        "status": app.get("status"),
        "applied_date": app.get("applied_date"),
        "job_url": app.get("job_url"),
        "job_board_source": app.get("job_board_source"),
    }


@mcp.tool()
def list_applications(status: Optional[str] = None, limit: int = 200) -> Any:
    """List tracked applications (compact view).

    Args:
        status: optional exact status filter, e.g. "Applied" or "Rejected".
        limit: max number to return.
    """
    with _client() as c:
        resp = c.get("/applications/", params={"limit": limit})
    if resp.status_code != 200:
        return _err(resp)
    apps = resp.json()
    if status:
        apps = [a for a in apps if a.get("status") == status]
    return [_trim(a) for a in apps]


@mcp.tool()
def find_applications(query: str) -> Any:
    """Find applications whose company or position contains `query` (case-insensitive).

    Use this to match an email (e.g. from "Acme Corp Recruiting") to a tracked
    application before changing its status.
    """
    q = query.lower().strip()
    with _client() as c:
        resp = c.get("/applications/", params={"limit": 500})
    if resp.status_code != 200:
        return _err(resp)
    matches = [
        a for a in resp.json()
        if q in (a.get("company_name") or "").lower()
        or q in (a.get("position_title") or "").lower()
    ]
    return [_trim(a) for a in matches]


@mcp.tool()
def get_application(application_id: str) -> Any:
    """Get the full record (including status history) for one application by id."""
    with _client() as c:
        resp = c.get(f"/applications/{application_id}")
    return resp.json() if resp.status_code == 200 else _err(resp)


@mcp.tool()
def mark_status(application_id: str, new_status: str, notes: Optional[str] = None) -> Any:
    """Change an application's status. Records history and may trigger a notification email.

    Only legal transitions are accepted by the backend:
      Shortlisted -> Applied | Rejected
      Applied     -> Replied | Rejected | Ghosted
      Replied     -> Phone Screen | Rejected | Ghosted
      Phone Screen-> Technical Round 1 | Rejected | Ghosted
      Tech Round 1-> Technical Round 2 | Rejected | Ghosted
      Tech Round 2-> Final Round | Rejected | Ghosted
      Final Round -> Offer | Rejected | Ghosted
      Offer       -> Rejected | Ghosted
      Rejected / Ghosted are terminal.
    On an illegal transition the backend returns an error describing it — read it and
    adjust (e.g. you may need to advance through an intermediate status first).
    """
    if new_status not in VALID_STATUSES:
        return {"error": "invalid_status", "detail": f"new_status must be one of {VALID_STATUSES}"}
    payload: dict = {"new_status": new_status}
    if notes:
        payload["notes"] = notes
    with _client() as c:
        resp = c.patch(f"/applications/{application_id}/status", json=payload)
    return resp.json() if resp.status_code == 200 else _err(resp)


@mcp.tool()
def create_application(
    company_name: str,
    position_title: str,
    location: str,
    status: str = "Applied",
    job_url: Optional[str] = None,
    salary_range: Optional[str] = None,
    tech_stack: Optional[str] = None,
    job_board_source: Optional[str] = None,
    notes: Optional[str] = None,
    applied_date: Optional[str] = None,
) -> Any:
    """Create a new application, e.g. when an email references a job you haven't tracked yet.

    `status` defaults to "Applied" (typical when the email is an application
    confirmation). `applied_date` is an ISO date (YYYY-MM-DD); defaults to today.
    """
    if status not in VALID_STATUSES:
        return {"error": "invalid_status", "detail": f"status must be one of {VALID_STATUSES}"}
    body = {
        "company_name": company_name,
        "position_title": position_title,
        "location": location,
        "status": status,
        "job_url": job_url,
        "salary_range": salary_range,
        "tech_stack": tech_stack,
        "job_board_source": job_board_source,
        "notes": notes,
        "applied_date": applied_date or date.today().isoformat(),
    }
    body = {k: v for k, v in body.items() if v is not None}
    with _client() as c:
        resp = c.post("/applications/", json=body)
    return resp.json() if resp.status_code == 200 else _err(resp)


@mcp.tool()
def update_application(
    application_id: str,
    location: Optional[str] = None,
    job_url: Optional[str] = None,
    salary_range: Optional[str] = None,
    tech_stack: Optional[str] = None,
    job_board_source: Optional[str] = None,
    notes: Optional[str] = None,
    followup_flagged: Optional[bool] = None,
) -> Any:
    """Enrich an existing application with job details discovered from an email.

    Only the provided fields are changed. Does NOT change status — use mark_status
    for that. Set followup_flagged to put the application in the followup queue.
    """
    body = {
        "location": location,
        "job_url": job_url,
        "salary_range": salary_range,
        "tech_stack": tech_stack,
        "job_board_source": job_board_source,
        "notes": notes,
        "followup_flagged": followup_flagged,
    }
    body = {k: v for k, v in body.items() if v is not None}
    if not body:
        return {"error": "no_fields", "detail": "Provide at least one field to update."}
    with _client() as c:
        resp = c.put(f"/applications/{application_id}", json=body)
    return resp.json() if resp.status_code == 200 else _err(resp)


if __name__ == "__main__":
    mcp.run()
