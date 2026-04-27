"""API tests for /auth/* endpoints.

All CRUD calls are mocked — no real database is used.
"""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

pytestmark = pytest.mark.api


# ── /auth/login ──────────────────────────────────────────────────────────────

class TestLoginEndpoint:

    def test_director_login_success(self, client):
        with patch("crud.check_director_credentials", return_value=True):
            resp = client.post("/auth/login", json={
                "username": "director",
                "password": "correct-password",
            })
        assert resp.status_code == 200
        data = resp.json()
        assert data["ok"] is True
        assert data["user"]["role"] == "director"
        assert data["user"]["pantryId"] == "director"

    def test_director_login_by_email(self, client):
        with patch("crud.check_director_credentials", return_value=True):
            resp = client.post("/auth/login", json={
                "username": "director@example.com",
                "password": "pw",
            })
        assert resp.status_code == 200
        assert resp.json()["ok"] is True

    def test_director_login_wrong_password(self, client):
        with patch("crud.check_director_credentials", return_value=False):
            resp = client.post("/auth/login", json={
                "username": "director",
                "password": "wrong",
            })
        assert resp.status_code == 200
        data = resp.json()
        assert data["ok"] is False
        assert "Invalid director" in data["error"]

    def test_pantry_login_by_numeric_id_success(self, client):
        with (
            patch("crud.check_credentials", return_value=True),
        ):
            resp = client.post("/auth/login", json={
                "username": "1",
                "password": "pantry-password",
            })
        assert resp.status_code == 200
        data = resp.json()
        assert data["ok"] is True
        assert data["user"]["role"] == "pantry"
        assert data["user"]["pantryId"] == "1"

    def test_pantry_login_by_name_success(self, client):
        with (
            patch("crud.get_pantry_id_by_name", return_value=5),
            patch("crud.check_credentials", return_value=True),
        ):
            resp = client.post("/auth/login", json={
                "username": "FPN Pantry A",
                "password": "pw",
            })
        assert resp.status_code == 200
        assert resp.json()["ok"] is True

    def test_pantry_name_not_found(self, client):
        with patch("crud.get_pantry_id_by_name", return_value=None):
            resp = client.post("/auth/login", json={
                "username": "No Such Pantry",
                "password": "pw",
            })
        assert resp.status_code == 200
        data = resp.json()
        assert data["ok"] is False
        assert "not found" in data["error"].lower()

    def test_pantry_wrong_password(self, client):
        with (
            patch("crud.check_credentials", return_value=False),
        ):
            resp = client.post("/auth/login", json={
                "username": "1",
                "password": "wrong",
            })
        assert resp.status_code == 200
        assert resp.json()["ok"] is False

    def test_empty_username_is_rejected(self, client):
        # FastAPI returns 422 (Unprocessable Entity) for Pydantic validation failures
        resp = client.post("/auth/login", json={"username": "", "password": "pw"})
        assert resp.status_code in (400, 422)

    def test_empty_password_is_rejected(self, client):
        resp = client.post("/auth/login", json={"username": "director", "password": ""})
        assert resp.status_code in (400, 422)

    def test_missing_body_is_422(self, client):
        resp = client.post("/auth/login", json={})
        assert resp.status_code == 422


# ── /auth/pantry-credentials ─────────────────────────────────────────────────

class TestListPantryCredentials:

    def test_returns_ok_with_empty_list(self, client):
        with patch("crud.get_pantry_credential_registry", return_value=[]):
            resp = client.get("/auth/pantry-credentials")
        assert resp.status_code == 200
        data = resp.json()
        assert data["ok"] is True
        assert data["pantries"] == []

    def test_returns_pantry_list(self, client):
        mock_pantries = [
            {
                "pantryId": "1",
                "name": "Test Pantry",
                "location": "123 Main St",
                "hasCredentials": True,
                "isOpen": True,
                "manualOverride": False,
                "operatingHours": [],
            }
        ]
        with patch("crud.get_pantry_credential_registry", return_value=mock_pantries):
            resp = client.get("/auth/pantry-credentials")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["pantries"]) == 1
        assert data["pantries"][0]["name"] == "Test Pantry"


# ── /auth/pantry/create ───────────────────────────────────────────────────────

class TestCreatePantry:

    def test_create_success(self, client):
        mock_pantry = MagicMock()
        mock_pantry.id = 42
        mock_pantry.name = "New Pantry"
        mock_pantry.location = "100 Elm St"

        with (
            patch("crud.add_pantry", return_value=mock_pantry),
            patch("crud.set_login_credentials", return_value=MagicMock()),
        ):
            resp = client.post("/auth/pantry/create", json={
                "name": "New Pantry",
                "location": "100 Elm St",
                "newPassword": "safe-pass-123",
            })
        assert resp.status_code == 200
        data = resp.json()
        assert data["ok"] is True
        assert data["pantry"]["pantryId"] == "42"

    def test_create_without_location(self, client):
        mock_pantry = MagicMock()
        mock_pantry.id = 10
        mock_pantry.name = "Minimal Pantry"
        mock_pantry.location = None

        with (
            patch("crud.add_pantry", return_value=mock_pantry),
            patch("crud.set_login_credentials"),
        ):
            resp = client.post("/auth/pantry/create", json={
                "name": "Minimal Pantry",
                "newPassword": "pw",
            })
        assert resp.status_code == 200
        assert resp.json()["ok"] is True

    def test_create_missing_name_is_400(self, client):
        resp = client.post("/auth/pantry/create", json={"newPassword": "pw"})
        assert resp.status_code in (400, 422)

    def test_create_missing_password_is_400(self, client):
        resp = client.post("/auth/pantry/create", json={"name": "Pantry"})
        assert resp.status_code in (400, 422)


# ── /auth/pantry/manage ───────────────────────────────────────────────────────

class TestManagePantry:

    def test_update_name_success(self, client):
        mock_pantry = MagicMock()
        mock_pantry.id = 1
        with patch("crud.update_pantry_metadata", return_value=mock_pantry):
            resp = client.post("/auth/pantry/manage", json={
                "pantryId": "1",
                "name": "Updated Name",
            })
        assert resp.status_code == 200
        assert resp.json()["ok"] is True

    def test_non_numeric_pantry_id_fails(self, client):
        resp = client.post("/auth/pantry/manage", json={
            "pantryId": "abc",
            "name": "Test",
        })
        assert resp.status_code == 200
        assert resp.json()["ok"] is False
        assert "numeric" in resp.json()["error"].lower()

    def test_no_fields_provided_fails(self, client):
        resp = client.post("/auth/pantry/manage", json={"pantryId": "1"})
        assert resp.status_code == 200
        assert resp.json()["ok"] is False

    def test_pantry_not_found_fails(self, client):
        with patch("crud.update_pantry_metadata", return_value=None):
            resp = client.post("/auth/pantry/manage", json={
                "pantryId": "999",
                "name": "Ghost Pantry",
            })
        assert resp.status_code == 200
        assert resp.json()["ok"] is False


# ── /auth/pantry/toggle-status ────────────────────────────────────────────────

class TestTogglePantryStatus:

    def test_toggle_open_to_closed(self, client):
        with patch("crud.toggle_pantry_status", return_value={
            "pantryId": "1", "isOpen": False, "manualOverride": True,
        }):
            resp = client.post("/auth/pantry/toggle-status", json={"pantryId": "1"})
        assert resp.status_code == 200
        data = resp.json()
        assert data["ok"] is True
        assert data["isOpen"] is False
        assert data["manualOverride"] is True

    def test_pantry_not_found_returns_error(self, client):
        with patch("crud.toggle_pantry_status", return_value=None):
            resp = client.post("/auth/pantry/toggle-status", json={"pantryId": "999"})
        assert resp.status_code == 200
        assert resp.json()["ok"] is False

    def test_non_numeric_id_returns_error(self, client):
        resp = client.post("/auth/pantry/toggle-status", json={"pantryId": "abc"})
        assert resp.status_code == 200
        assert resp.json()["ok"] is False


# ── /auth/pantry/schedule ─────────────────────────────────────────────────────

class TestUpdatePantrySchedule:

    def test_valid_schedule_saved(self, client):
        with patch("crud.update_pantry_operating_hours", return_value={
            "pantryId": "1",
            "operatingHours": [{"day": "mon", "open": "09:00", "close": "17:00"}],
            "isOpen": True,
            "manualOverride": False,
        }):
            resp = client.post("/auth/pantry/schedule", json={
                "pantryId": "1",
                "operatingHours": [{"day": "mon", "open": "09:00", "close": "17:00"}],
            })
        assert resp.status_code == 200
        assert resp.json()["ok"] is True

    def test_invalid_day_name_fails(self, client):
        resp = client.post("/auth/pantry/schedule", json={
            "pantryId": "1",
            "operatingHours": [{"day": "monday", "open": "09:00", "close": "17:00"}],
        })
        assert resp.status_code == 200
        assert resp.json()["ok"] is False

    def test_close_before_open_fails(self, client):
        resp = client.post("/auth/pantry/schedule", json={
            "pantryId": "1",
            "operatingHours": [{"day": "mon", "open": "17:00", "close": "09:00"}],
        })
        assert resp.status_code == 200
        assert resp.json()["ok"] is False

    def test_empty_schedule_clears_hours(self, client):
        with patch("crud.update_pantry_operating_hours", return_value={
            "pantryId": "1",
            "operatingHours": [],
            "isOpen": False,
            "manualOverride": False,
        }):
            resp = client.post("/auth/pantry/schedule", json={
                "pantryId": "1",
                "operatingHours": [],
            })
        assert resp.status_code == 200
        assert resp.json()["ok"] is True


# ── /auth/director/password ───────────────────────────────────────────────────

class TestUpdateDirectorPassword:

    def test_update_success(self, client):
        with patch("crud.set_director_credentials"):
            resp = client.post("/auth/director/password", json={
                "email": "director@example.com",
                "newPassword": "new-secret-pass",
            })
        assert resp.status_code == 200
        assert resp.json()["ok"] is True

    def test_wrong_email_fails(self, client):
        resp = client.post("/auth/director/password", json={
            "email": "hacker@evil.com",
            "newPassword": "pw",
        })
        assert resp.status_code == 200
        assert resp.json()["ok"] is False

    def test_empty_password_is_rejected(self, client):
        # FastAPI returns 422 (Unprocessable Entity) when Pydantic min_length fails
        resp = client.post("/auth/director/password", json={
            "email": "director@example.com",
            "newPassword": "",
        })
        assert resp.status_code in (400, 422)
