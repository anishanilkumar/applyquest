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
