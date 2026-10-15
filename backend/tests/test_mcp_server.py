import json

import httpx
import pytest

import mcp_server


@pytest.fixture
def requests(monkeypatch):
    """Route the MCP server's API client to a stub and record every request."""
    seen = []

    def handler(request):
        seen.append(request)
        return httpx.Response(200, json=[{"id": "a1", "company_name": "Acme", "status": "Applied"}])

    monkeypatch.setattr(
        mcp_server, "_client",
        lambda: httpx.Client(base_url="http://api", transport=httpx.MockTransport(handler)),
    )
    return seen


def test_find_searches_server_side_without_a_cap(requests):
    result = mcp_server.find_applications("  Acme ")

    (req,) = requests
    assert dict(req.url.params) == {"q": "Acme"}
    assert result[0]["company_name"] == "Acme"


def test_find_rejects_a_blank_query(requests):
    assert mcp_server.find_applications("  ")["error"] == "empty_query"
    assert requests == []


def test_list_filters_status_before_limiting(requests):
    mcp_server.list_applications(status="Applied", limit=10)

    (req,) = requests
    assert dict(req.url.params) == {"status": "Applied", "limit": "10"}


def test_list_rejects_an_unknown_status(requests):
    assert mcp_server.list_applications(status="applied")["error"] == "invalid_status"
    assert requests == []


def test_create_sends_effort_defaulting_to_unknown(requests):
    mcp_server.create_application("Acme", "SWE", "Berlin")

    (req,) = requests
    assert json.loads(req.content)["effort"] == "Unknown"


def test_update_can_set_effort_alone(requests):
    mcp_server.update_application("a1", effort="Full")

    (req,) = requests
    assert json.loads(req.content) == {"effort": "Full"}


def test_effort_is_validated_before_any_request(requests):
    assert mcp_server.create_application("Acme", "SWE", "Berlin", effort="full")["error"] == "invalid_effort"
    assert mcp_server.update_application("a1", effort="Easy")["error"] == "invalid_effort"
    assert requests == []


def test_find_by_job_url_filters_exactly(requests):
    mcp_server.find_applications(job_url=" https://jobs.example/1 ")

    (req,) = requests
    assert dict(req.url.params) == {"job_url": "https://jobs.example/1"}


def test_create_sends_ai_job_search_fields(requests):
    mcp_server.create_application(
        "Acme", "SWE", "Berlin", status="Shortlisted", effort="Full",
        fit_score=72, role_type="Fullstack", cv_file="cv/main_acme_swe.tex",
    )

    (req,) = requests
    body = json.loads(req.content)
    assert body["status"] == "Shortlisted"
    assert body["fit_score"] == 72
    assert body["role_type"] == "Fullstack"
    assert body["cv_file"] == "cv/main_acme_swe.tex"
    assert "cover_letter_file" not in body


def test_fit_score_is_validated_before_any_request(requests):
    assert mcp_server.update_application("a1", fit_score=150)["error"] == "invalid_fit_score"
    assert requests == []


def test_outcome_stats_groups_submitted_applications():
    apps = [
        {"status": "Shortlisted", "role_type": "AI/ML", "fit_score": 90},
        {"status": "Rejected", "role_type": "AI/ML", "fit_score": 80, "cover_letter_file": "c.tex",
         "history": [{"old_status": "Applied", "new_status": "Phone Screen"},
                     {"old_status": "Phone Screen", "new_status": "Rejected"}]},
        {"status": "Ghosted", "role_type": "Fullstack", "fit_score": 62},
        {"status": "Applied", "role_type": None, "fit_score": None},
    ]
    stats = mcp_server._outcome_stats(apps)

    assert stats["overall"] == {"submitted": 3, "positive": 1, "interview": 1, "rejected": 1, "ghosted": 1}
    assert stats["role_type"]["AI/ML"]["submitted"] == 1  # the shortlisted one is not submitted
    assert stats["fit_band"]["Strong (75+)"]["interview"] == 1
    assert stats["fit_band"]["Unscored"]["submitted"] == 1
    assert stats["cover_letter"]["Yes"]["positive"] == 1


def test_outcome_stats_leaves_out_skipped_drafts():
    apps = [
        {"status": "Rejected", "history": [{"old_status": "Shortlisted", "new_status": "Rejected"}]},
        {"status": "Rejected", "history": [{"old_status": "Shortlisted", "new_status": "Applied"},
                                           {"old_status": "Applied", "new_status": "Rejected"}]},
    ]
    assert mcp_server._outcome_stats(apps)["overall"]["submitted"] == 1


def test_record_interview_posts_only_what_was_given(requests):
    mcp_server.record_interview("a1", "2026-10-16T16:00:00+02:00", stage="Phone Screen", calendar_event_id="evt-1")

    (req,) = requests
    assert req.url.path == "/interviews/"
    assert json.loads(req.content) == {
        "application_id": "a1", "starts_at": "2026-10-16T16:00:00+02:00",
        "stage": "Phone Screen", "calendar_event_id": "evt-1",
    }


def test_list_interviews_bounds_to_upcoming(requests):
    mcp_server.list_interviews()

    (req,) = requests
    assert "after" in dict(req.url.params)
