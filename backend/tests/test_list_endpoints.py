from types import SimpleNamespace
from unittest.mock import MagicMock

from app.api.v1.endpoints.applications import read_applications
from app.api.v1.endpoints.network import read_network_contacts


def make_db(rows):
    db = MagicMock()
    query = db.query.return_value.filter.return_value.order_by.return_value.offset.return_value
    query.all.return_value = rows
    query.limit.return_value.all.return_value = rows[:1]
    return db, query


def make_user():
    return SimpleNamespace(id="user-1")


# The web UI calls these without a limit; a default cap silently hid every
# application past the 100th.

def test_applications_are_uncapped_by_default():
    db, query = make_db(["a", "b", "c"])

    result = read_applications(db=db, current_user=make_user())

    query.limit.assert_not_called()
    assert result == ["a", "b", "c"]


def test_applications_honour_an_explicit_limit():
    db, query = make_db(["a", "b", "c"])

    result = read_applications(limit=1, db=db, current_user=make_user())

    query.limit.assert_called_once_with(1)
    assert result == ["a"]


def test_contacts_are_uncapped_by_default():
    db, query = make_db(["a", "b", "c"])

    result = read_network_contacts(db=db, current_user=make_user())

    query.limit.assert_not_called()
    assert result == ["a", "b", "c"]


# Filters must run in SQL (the MCP server relies on this instead of fetching
# everything), so compile the real query and inspect its WHERE clause.

from sqlalchemy.dialects import postgresql  # noqa: E402
from sqlalchemy.orm import Query, Session  # noqa: E402

from app.models.application import ApplicationStatus  # noqa: E402


class CompilingQuery(Query):
    def all(self):
        return [str(self.statement.compile(
            dialect=postgresql.dialect(), compile_kwargs={"literal_binds": True},
        ))]


def compiled_sql(**filters):
    db = Session(query_cls=CompilingQuery)
    (sql,) = read_applications(db=db, current_user=SimpleNamespace(id=1), **filters)
    return sql


def test_status_filter_runs_in_sql():
    assert "application.status = 'APPLIED'" in compiled_sql(status=ApplicationStatus.APPLIED)


def test_search_matches_company_or_position_case_insensitively():
    sql = compiled_sql(q="  Acme ")
    assert "application.company_name ILIKE '%%Acme%%'" in sql
    assert "application.position_title ILIKE '%%Acme%%'" in sql


class ParamsQuery(Query):
    def all(self):
        return [self.statement.compile().params]


def test_search_escapes_like_wildcards():
    db = Session(query_cls=ParamsQuery)
    (params,) = read_applications(db=db, current_user=SimpleNamespace(id=1), q="50%_off")
    assert "%50\\%\\_off%" in params.values()


def test_blank_search_is_ignored():
    assert "ILIKE" not in compiled_sql(q="   ")


def test_results_are_newest_first():
    assert "ORDER BY application.created_at DESC" in compiled_sql()
