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
