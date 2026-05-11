"""******************************* test_upload.py ***************************************
 *
 *  Module: Backend API Test Upload Test
 *
 *  This module defines automated backend checks for backend api test upload test.
 *
 *  The module provides:
 *
 *  - pytest cases for API, domain, and workflow behavior.
 *  - mocked dependencies and fixtures where external services are not needed.
 *  - regression coverage for inventory, auth, upload, and chatbot flows.
 *
 *  Key Structures Used:
 *
 *  - pytest fixtures, FastAPI test clients, monkeypatching, and unittest mocks.
 *
 *  This module ensures:
 *
 *  - backend behavior remains stable as the application evolves.
 *  - database and service boundaries are tested without unsafe side effects.
 *
 *  Editors: Aniket, Dipanker, Liam, Jin, and Philip.
 *
 ****************************************************************************
"""
from __future__ import annotations

import io
from unittest.mock import MagicMock, patch

import pytest

from back.inventory_domain import INVENTORY_CATEGORIES

pytestmark = pytest.mark.api


def _make_image(name: str = "shelf.jpg", size: int = 1024) -> tuple[str, io.BytesIO, str]:
    """Return a (field_name, file_obj, content_type) tuple for multipart upload."""
    return ("files", (name, io.BytesIO(b"X" * size), "image/jpeg"))


def _make_text_file(name: str = "doc.txt") -> tuple:
    return ("files", (name, io.BytesIO(b"text content"), "text/plain"))


MOCK_INVENTORY = {cat: 5 for cat in INVENTORY_CATEGORIES}


# ── GET / ─────────────────────────────────────────────────────────────────────

class TestRootEndpoint:

    def test_root_returns_ok(self, client):
        resp = client.get("/")
        assert resp.status_code == 200
        assert resp.json() == {"status": "ok"}


# ── GET /categories ───────────────────────────────────────────────────────────

class TestCategoriesEndpoint:

    def test_returns_19_categories(self, client):
        resp = client.get("/categories")
        assert resp.status_code == 200
        cats = resp.json()["categories"]
        assert len(cats) == 19

    def test_categories_match_domain_list(self, client):
        resp = client.get("/categories")
        assert resp.json()["categories"] == INVENTORY_CATEGORIES


# ── POST /upload ──────────────────────────────────────────────────────────────

class TestUploadEndpoint:

    def test_upload_single_image_returns_ok(self, client):
        with patch("back.routers.upload.call_gemini_inventory_images", return_value=MOCK_INVENTORY):
            resp = client.post(
                "/upload",
                files=[_make_image()],
            )
        assert resp.status_code == 200
        data = resp.json()
        assert data["ok"] is True
        assert data["count"] == 1
        assert "inventory" in data

    def test_upload_multiple_images_aggregates(self, client):
        with patch("back.routers.upload.call_gemini_inventory_images", return_value=MOCK_INVENTORY):
            resp = client.post(
                "/upload",
                files=[_make_image("a.jpg"), _make_image("b.jpg")],
            )
        data = resp.json()
        assert data["ok"] is True
        assert data["count"] == 2

    def test_upload_multiple_images_retries_individually_when_batch_detection_fails(self, client):
        first_image_inventory = {cat: 1 for cat in INVENTORY_CATEGORIES}
        second_image_inventory = {cat: 2 for cat in INVENTORY_CATEGORIES}

        with patch(
            "back.routers.upload.call_gemini_inventory_images",
            side_effect=[None, first_image_inventory, second_image_inventory],
        ) as mock_gemini:
            resp = client.post(
                "/upload",
                files=[_make_image("a.jpg"), _make_image("b.jpg")],
            )

        data = resp.json()
        assert data["ok"] is True
        assert data["count"] == 2
        assert data["inventory"][INVENTORY_CATEGORIES[0]] == 3
        assert mock_gemini.call_count == 3

    def test_upload_no_files_returns_error(self, client):
        resp = client.post("/upload", data={})
        assert resp.status_code in (200, 422)
        # If 200, should report an error
        if resp.status_code == 200:
            assert resp.json()["ok"] is False

    def test_upload_non_image_file_is_rejected(self, client):
        with patch("back.routers.upload.call_gemini_inventory_images", return_value=None):
            resp = client.post(
                "/upload",
                files=[_make_text_file()],
            )
        data = resp.json()
        assert data["ok"] is False
        assert any(
            f.get("ok") is False or "Not an image" in str(f.get("error", ""))
            for f in data.get("files", [data])
        )

    def test_upload_with_director_pantry_id_returns_error(self, client):
        resp = client.post(
            "/upload",
            files=[_make_image()],
            data={"pantry_id": "director"},
        )
        assert resp.status_code == 200
        assert resp.json()["ok"] is False
        assert "director" in resp.json()["error"].lower()

    def test_upload_with_valid_pantry_id_loads_max_quantities(self, client):
        mock_db = MagicMock()
        mock_pantry = MagicMock()
        mock_pantry.id = 1
        mock_db.query.return_value.filter.return_value.first.return_value = mock_pantry
        mock_items = [MagicMock(category_name=cat, original_quantity=100)
                      for cat in INVENTORY_CATEGORIES[:5]]
        mock_db.query.return_value.filter.return_value.all.return_value = mock_items

        with (
            patch("back.routers.upload.SessionLocal", return_value=mock_db),
            patch("back.routers.upload.resolve_pantry", return_value=mock_pantry),
            patch("back.routers.upload.call_gemini_inventory_images", return_value=MOCK_INVENTORY),
            patch("back.routers.upload.save_inventory_draft"),
        ):
            resp = client.post(
                "/upload",
                files=[_make_image()],
                data={"pantry_id": "1"},
            )
        assert resp.status_code == 200
        assert resp.json()["ok"] is True

    def test_upload_gemini_returns_none_reports_detection_error(self, client):
        with patch("back.routers.upload.call_gemini_inventory_images", return_value=None):
            resp = client.post(
                "/upload",
                files=[_make_image()],
            )
        data = resp.json()
        assert data["ok"] is False
        assert "detect inventory" in data["error"].lower()
        assert "inventory" not in data

    def test_upload_inventory_saved_to_draft_when_pantry_id_provided(self, client):
        mock_db = MagicMock()
        mock_pantry = MagicMock()
        mock_pantry.id = 1
        mock_db.query.return_value.filter.return_value.first.return_value = mock_pantry
        mock_db.query.return_value.filter.return_value.all.return_value = []

        with (
            patch("back.routers.upload.SessionLocal", return_value=mock_db),
            patch("back.routers.upload.resolve_pantry", return_value=mock_pantry),
            patch("back.routers.upload.call_gemini_inventory_images", return_value=MOCK_INVENTORY),
            patch("back.routers.upload.save_inventory_draft") as mock_draft,
        ):
            resp = client.post(
                "/upload",
                files=[_make_image()],
                data={"pantry_id": "1"},
            )
        mock_draft.assert_called_once()
        assert resp.json()["ok"] is True
