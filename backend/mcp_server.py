"""
ApplyQuest MCP server.

Exposes a small set of agent-friendly tools over the ApplyQuest REST API so that
Claude (e.g. with the Gmail connector enabled) can reconcile your inbox with your
tracked applications: find a job, mark it Applied/Rejected, or create it with the
job details pulled from an email.

This is a thin client — it just calls the running backend with the static API key,
so all status-transition rules, history records, gamification and notification
emails happen exactly as they do for the web UI.

Two transports, chosen by APPLYQUEST_MCP_TRANSPORT:

  stdio (default)   launched by a local MCP client via the repo's .mcp.json:
                    APPLYQUEST_API_KEY=... backend/.venv/bin/python backend/mcp_server.py
  streamable-http   long-running service on 127.0.0.1, fronted by nginx, so
                    claude.ai can add it as a Custom Connector. Callers must
                    present an OAuth 2.1 bearer token issued by Kanidm; this
                    replaced a secret URL path, which was a credential living in
                    a URL and so leaked through history and screenshots, never
                    expired, and was shared rather than per-person.
                    Deployed as systemd.services.applyquest-mcp in nixos-config.

Note the two transports have different trust models. stdio is spawned by a local
client that already has the machine, so it is unauthenticated by design; only
the HTTP transport, which is reachable from the internet, requires a token.

Environment:
    APPLYQUEST_API_KEY       (required) must match settings.APPLYQUEST_API_KEY on the backend
    APPLYQUEST_API_BASE      (optional) defaults to http://localhost:8000/api/v1
    APPLYQUEST_MCP_TRANSPORT (optional) "stdio" (default) or "streamable-http"
    APPLYQUEST_MCP_HOST/_PORT/_PATH          listener, defaults 127.0.0.1:8766/mcp
    APPLYQUEST_MCP_PUBLIC_HOST               Host header accepted from the proxy
    APPLYQUEST_MCP_OIDC_*                    token validation (see mcp_auth.verifier_from_env)
"""
import logging
import os
import sys
from datetime import date
from typing import Any, Optional

import httpx
from mcp.server.auth.settings import AuthSettings
from mcp.server.fastmcp import FastMCP
from mcp.server.transport_security import TransportSecuritySettings

from mcp_auth import verifier_from_env

# The auth layer logs why a token was rejected; without this those warnings go
# nowhere and a failed handshake is invisible from both ends.
logging.basicConfig(level=logging.INFO)

API_BASE = os.environ.get("APPLYQUEST_API_BASE", "http://localhost:8000/api/v1").rstrip("/")
API_KEY = os.environ.get("APPLYQUEST_API_KEY", "")

TRANSPORT = os.environ.get("APPLYQUEST_MCP_TRANSPORT", "stdio")
HOST = os.environ.get("APPLYQUEST_MCP_HOST", "127.0.0.1")
PORT = int(os.environ.get("APPLYQUEST_MCP_PORT", "8766"))
PUBLIC_HOST = os.environ.get("APPLYQUEST_MCP_PUBLIC_HOST", "applyquest-mcp.anishsheela.com")
MCP_PATH = os.environ.get("APPLYQUEST_MCP_PATH", "/mcp")

# The identity this server trusts, and the name it calls itself by. PUBLIC_URL
# has to match what gets typed into Claude exactly, path and all.
OIDC_ISSUER = os.environ.get(
    "APPLYQUEST_MCP_OIDC_ISSUER",
    "https://auth.anishsheela.com/oauth2/openid/claude-applyquest",
).rstrip("/")
PUBLIC_URL = os.environ.get(
    "APPLYQUEST_MCP_PUBLIC_URL", f"https://{PUBLIC_HOST}{MCP_PATH}"
)

# The full set of statuses the backend accepts, in pipeline order. Only some
# transitions are legal (see mark_status docstring).
VALID_STATUSES = [
    "Shortlisted", "Applied", "Replied", "Phone Screen",
    "Technical Round 1", "Technical Round 2", "Final Round",
    "Offer", "Rejected", "Ghosted",
]

# How much effort went into an application. Unknown is the default for anything
# not yet classified.
VALID_EFFORTS = ["Full", "Light", "Generic", "Unknown"]

# DNS-rebinding protection for the HTTP transport. The SDK leaves this off when
# transport_security is unset and — the trap — rejects everything with 421 if it
# is switched on with an empty allow-list, so name the hosts explicitly: the
# public name nginx proxies under, plus loopback for curl on the box.
SECURITY = TransportSecuritySettings(
    enable_dns_rebinding_protection=True,
    allowed_hosts=[
        PUBLIC_HOST,
        f"{HOST}:{PORT}",
        f"localhost:{PORT}",
    ],
)

# Only the HTTP transport is reachable from the internet and so only it requires
# a token. Under stdio the client already has the machine, and attaching an
# authorization server there would mean a local run could not start without
# Kanidm being up.
if TRANSPORT == "streamable-http":
    AUTH_KWARGS = {
        "token_verifier": verifier_from_env(
            "APPLYQUEST_MCP", default_client_id="claude-applyquest"
        ),
        # Makes the SDK serve /.well-known/oauth-protected-resource and answer
        # an unauthenticated call with 401 + WWW-Authenticate pointing at it.
        # That handshake is how Claude discovers where to send the user to log
        # in; without it the connector cannot find the authorization server.
        "auth": AuthSettings(
            issuer_url=OIDC_ISSUER,
            # Must equal the URL as typed into Claude, path included, or the
            # metadata is rejected as not describing this resource.
            resource_server_url=PUBLIC_URL,
            required_scopes=["mcp"],
        ),
    }
else:
    AUTH_KWARGS = {}

mcp = FastMCP(
    "applyquest",
    instructions=(
        "Job-application tracker. Read tools return the live pipeline; write "
        "tools go through the same REST API as the web UI, so status-transition "
        "rules, history, points and notification emails all still apply. Match "
        "an email to an application with find_applications before changing "
        "anything — never guess an id."
    ),
    host=HOST,
    port=PORT,
    streamable_http_path=MCP_PATH,
    # Stateless: every HTTP request is self-contained, so a restart or a proxy
    # hiccup never strands a client holding a dead session id.
    stateless_http=True,
    transport_security=SECURITY,
    **AUTH_KWARGS,
)


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
        "effort": app.get("effort"),
        "applied_date": app.get("applied_date"),
        "job_url": app.get("job_url"),
        "job_board_source": app.get("job_board_source"),
        "fit_score": app.get("fit_score"),
        "role_type": app.get("role_type"),
        "archive_dir": app.get("archive_dir"),
    }


@mcp.tool()
def list_applications(status: Optional[str] = None, limit: int = 200) -> Any:
    """List tracked applications (compact view), newest first.

    Args:
        status: optional exact status filter, e.g. "Applied" or "Rejected".
        limit: max number to return.
    """
    if status and status not in VALID_STATUSES:
        return {"error": "invalid_status", "detail": f"status must be one of {VALID_STATUSES}"}
    params: dict = {"limit": limit}
    if status:
        params["status"] = status
    with _client() as c:
        resp = c.get("/applications/", params=params)
    if resp.status_code != 200:
        return _err(resp)
    return [_trim(a) for a in resp.json()]


@mcp.tool()
def find_applications(query: str = "", job_url: Optional[str] = None) -> Any:
    """Find applications whose company or position contains `query` (case-insensitive),
    or whose job_url is exactly `job_url`.

    Use this to match an email (e.g. from "Acme Corp Recruiting") to a tracked
    application before changing its status. Pass job_url when you hold the
    posting URL — it is the most reliable match.
    """
    q = query.strip()
    url = (job_url or "").strip()
    if not q and not url:
        return {"error": "empty_query", "detail": "provide query or job_url"}
    params = {}
    if q:
        params["q"] = q
    if url:
        params["job_url"] = url
    with _client() as c:
        resp = c.get("/applications/", params=params)
    if resp.status_code != 200:
        return _err(resp)
    return [_trim(a) for a in resp.json()]


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
      Rejected    -> Applied | Replied | Phone Screen | Tech Round 1/2 | Final Round | Offer
      Ghosted     -> Rejected | any of the stages Rejected can reopen to
    Rejected/Ghosted can be reopened because an application sometimes comes back.
    Any stage from Applied to Offer can also step back exactly one stage, to correct
    an application advanced too far; a step back sends no notification email.
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
    effort: str = "Unknown",
    fit_score: Optional[int] = None,
    role_type: Optional[str] = None,
    cv_file: Optional[str] = None,
    cover_letter_file: Optional[str] = None,
    research_file: Optional[str] = None,
    archive_dir: Optional[str] = None,
) -> Any:
    """Create a new application record when no existing one matches.

    Use after find_applications turns up nothing for a job referenced in an email.
    Defaults status to "Applied" (typical when the email is an application
    confirmation), applied_date (ISO YYYY-MM-DD) to today and effort to "Unknown".
    Returns the full created record, including its new id.

    Use status "Shortlisted" for an application whose documents are drafted but
    not yet submitted; mark_status moves it to "Applied" once it is sent, which
    also sets applied_date to that day.

    Fields written by the ai-job-search workflow: fit_score (its 0-100 fit
    score), role_type (e.g. "Fullstack", "AI/ML", "Backend"), and the file names
    of the documents prepared for the application — cv_file, cover_letter_file,
    research_file — and archive_dir, the application's folder name under
    documents/applications/ (e.g. "acme_backend_engineer"). Store names/paths
    only, never document contents.

    effort is how much went into the application: "Full" (tailored CV and cover
    letter, screening questions answered), "Light" (some tailoring), "Generic"
    (standard CV, no tailoring, e.g. a one-click Easy Apply) or "Unknown".
    """
    if status not in VALID_STATUSES:
        return {"error": "invalid_status", "detail": f"status must be one of {VALID_STATUSES}"}
    if effort not in VALID_EFFORTS:
        return {"error": "invalid_effort", "detail": f"effort must be one of {VALID_EFFORTS}"}
    if fit_score is not None and not 0 <= fit_score <= 100:
        return {"error": "invalid_fit_score", "detail": "fit_score must be 0-100"}
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
        "effort": effort,
        "fit_score": fit_score,
        "role_type": role_type,
        "cv_file": cv_file,
        "cover_letter_file": cover_letter_file,
        "research_file": research_file,
        "archive_dir": archive_dir,
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
    effort: Optional[str] = None,
    fit_score: Optional[int] = None,
    role_type: Optional[str] = None,
    cv_file: Optional[str] = None,
    cover_letter_file: Optional[str] = None,
    research_file: Optional[str] = None,
    archive_dir: Optional[str] = None,
) -> Any:
    """Enrich an existing application with job details discovered from an email.

    Only the provided fields are changed. Does NOT change status — use mark_status
    for that.

    Fields written by the ai-job-search workflow: fit_score (its 0-100 fit
    score), role_type (e.g. "Fullstack", "AI/ML", "Backend"), and the file names
    of the documents prepared for the application — cv_file, cover_letter_file,
    research_file — and archive_dir, the application's folder name under
    documents/applications/ (e.g. "acme_backend_engineer"). Store names/paths
    only, never document contents.

    effort is how much went into the application: "Full" (tailored CV and cover
    letter, screening questions answered), "Light" (some tailoring), "Generic"
    (standard CV, no tailoring, e.g. a one-click Easy Apply) or "Unknown".
    """
    if effort is not None and effort not in VALID_EFFORTS:
        return {"error": "invalid_effort", "detail": f"effort must be one of {VALID_EFFORTS}"}
    if fit_score is not None and not 0 <= fit_score <= 100:
        return {"error": "invalid_fit_score", "detail": "fit_score must be 0-100"}
    body = {
        "location": location,
        "job_url": job_url,
        "salary_range": salary_range,
        "tech_stack": tech_stack,
        "job_board_source": job_board_source,
        "notes": notes,
        "effort": effort,
        "fit_score": fit_score,
        "role_type": role_type,
        "cv_file": cv_file,
        "cover_letter_file": cover_letter_file,
        "research_file": research_file,
        "archive_dir": archive_dir,
    }
    body = {k: v for k, v in body.items() if v is not None}
    if not body:
        return {"error": "no_fields", "detail": "Provide at least one field to update."}
    with _client() as c:
        resp = c.put(f"/applications/{application_id}", json=body)
    return resp.json() if resp.status_code == 200 else _err(resp)


# Outcome grouping for outcome_stats. Positive mirrors the frontend's
# utils/stages.ts: a reply or any later stage, never a rejection or ghosting.
POSITIVE_STATUSES = {
    "Replied", "Phone Screen", "Technical Round 1", "Technical Round 2", "Final Round", "Offer",
}
INTERVIEW_STATUSES = POSITIVE_STATUSES - {"Replied"}


def _fit_band(score: Optional[int]) -> str:
    # The verdict bands of ai-job-search's 04-job-evaluation.md.
    if score is None:
        return "Unscored"
    if score >= 75:
        return "Strong (75+)"
    if score >= 60:
        return "Good (60-74)"
    if score >= 45:
        return "Moderate (45-59)"
    return "Weak (<45)"


def _was_submitted(app: dict) -> bool:
    # A draft still in Shortlisted, or one skipped from there straight to
    # Rejected, never went out. Mirrors isSubmitted in the frontend.
    if app.get("status") == "Shortlisted":
        return False
    moves = {(h.get("old_status"), h.get("new_status")) for h in app.get("history") or []}
    skipped = ("Shortlisted", "Rejected") in moves and not any(new == "Applied" for _, new in moves)
    return not skipped


def _outcome_stats(apps: list[dict]) -> dict:
    dimensions = {
        "role_type": lambda a: a.get("role_type") or "Unknown",
        "job_board_source": lambda a: a.get("job_board_source") or "Unknown",
        "effort": lambda a: a.get("effort") or "Unknown",
        "fit_band": lambda a: _fit_band(a.get("fit_score")),
        "cover_letter": lambda a: "Yes" if a.get("cover_letter_file") else "No",
    }
    submitted = [a for a in apps if _was_submitted(a)]

    def reached(app: dict) -> set:
        held = {app.get("status")}
        for h in app.get("history") or []:
            held.update({h.get("old_status"), h.get("new_status")})
        return held

    def summarise(group: list[dict]) -> dict:
        held = [reached(a) for a in group]
        return {
            "submitted": len(group),
            "positive": sum(1 for h in held if h & POSITIVE_STATUSES),
            "interview": sum(1 for h in held if h & INTERVIEW_STATUSES),
            "rejected": sum(1 for a in group if a.get("status") == "Rejected"),
            "ghosted": sum(1 for a in group if a.get("status") == "Ghosted"),
        }

    result: dict = {"overall": summarise(submitted)}
    for name, key in dimensions.items():
        groups: dict[str, list] = {}
        for app in submitted:
            groups.setdefault(key(app), []).append(app)
        result[name] = {
            value: summarise(group)
            for value, group in sorted(groups.items(), key=lambda kv: -len(kv[1]))
        }
    return result


@mcp.tool()
def outcome_stats() -> Any:
    """Track record of submitted applications, for deciding where to spend effort.

    Counts submitted applications (not drafts still Shortlisted or skipped from
    there) overall and grouped by
    role_type, job_board_source, effort, fit_band (Strong 75+ / Good 60-74 /
    Moderate 45-59 / Weak <45 / Unscored) and cover_letter (Yes/No). Each group
    reports submitted, positive (a reply or any later stage), interview,
    rejected and ghosted. Compact: one call instead of listing every application.
    Small groups are noisy — weigh a rate by its submitted count.
    """
    with _client() as c:
        resp = c.get("/applications/")
    if resp.status_code != 200:
        return _err(resp)
    return _outcome_stats(resp.json())


if __name__ == "__main__":
    if TRANSPORT not in ("stdio", "streamable-http"):
        sys.exit(f"APPLYQUEST_MCP_TRANSPORT must be stdio or streamable-http, got {TRANSPORT!r}")
    # Fail loudly at startup rather than on the first tool call: under systemd a
    # missing key would otherwise look like a healthy service that errors forever.
    if TRANSPORT == "streamable-http" and not API_KEY:
        sys.exit("APPLYQUEST_API_KEY is not set; refusing to start the HTTP server.")
    sys.exit(mcp.run(transport=TRANSPORT))
