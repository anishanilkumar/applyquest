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
