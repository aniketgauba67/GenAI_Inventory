"""API tests for POST /chat/message."""

from __future__ import annotations

from unittest.mock import patch

import pytest

pytestmark = pytest.mark.api


class TestChatEndpoint:

    def test_valid_message_returns_reply(self, client):
        with patch("routers.chat.call_gemini_chat", return_value="Hello from the bot!"):
            resp = client.post("/chat/message", json={
                "message": "What pantries are open today?",
                "history": [],
            })
        assert resp.status_code == 200
        data = resp.json()
        assert data["ok"] is True
        assert data["reply"] == "Hello from the bot!"

    def test_empty_message_fails_validation(self, client):
        resp = client.post("/chat/message", json={"message": "", "history": []})
        assert resp.status_code == 422

    def test_missing_message_field_is_422(self, client):
        resp = client.post("/chat/message", json={"history": []})
        assert resp.status_code == 422

    def test_gemini_returns_none_gives_error(self, client):
        with patch("routers.chat.call_gemini_chat", return_value=None):
            resp = client.post("/chat/message", json={"message": "hello", "history": []})
        assert resp.status_code == 200
        data = resp.json()
        assert data["ok"] is False
        assert "unavailable" in data["error"].lower()

    def test_gemini_returns_empty_string_gives_error(self, client):
        with patch("routers.chat.call_gemini_chat", return_value=""):
            resp = client.post("/chat/message", json={"message": "hello"})
        assert resp.status_code == 200
        assert resp.json()["ok"] is False

    def test_history_is_forwarded(self, client):
        captured = {}
        def fake_chat(**kwargs):
            captured.update(kwargs)
            return "response"
        # Send as JSON lists; Pydantic converts list[list] → list[tuple[str,str]]
        with patch("routers.chat.call_gemini_chat", side_effect=fake_chat):
            client.post("/chat/message", json={
                "message": "follow-up",
                "history": [["user", "prev msg"], ["assistant", "prev reply"]],
            })
        # Pydantic model field is list[tuple[str, str]], so compare to tuples
        assert captured.get("history") == [("user", "prev msg"), ("assistant", "prev reply")]

    def test_pantry_id_is_forwarded(self, client):
        captured = {}
        def fake_chat(**kwargs):
            captured.update(kwargs)
            return "ok"
        with patch("routers.chat.call_gemini_chat", side_effect=fake_chat):
            client.post("/chat/message", json={
                "message": "hello",
                "pantry_id": 5,
            })
        assert captured.get("pantry_id") == 5

    def test_user_location_is_forwarded(self, client):
        captured = {}
        def fake_chat(**kwargs):
            captured.update(kwargs)
            return "ok"
        with patch("routers.chat.call_gemini_chat", side_effect=fake_chat):
            client.post("/chat/message", json={
                "message": "closest pantry near me",
                "user_location": {
                    "latitude": 40.02,
                    "longitude": -82.44,
                    "accuracy": 25,
                },
            })
        assert captured.get("user_location") == {
            "latitude": 40.02,
            "longitude": -82.44,
            "accuracy": 25.0,
        }

    def test_null_pantry_id_is_accepted(self, client):
        with patch("routers.chat.call_gemini_chat", return_value="ok"):
            resp = client.post("/chat/message", json={
                "message": "hello",
                "pantry_id": None,
            })
        assert resp.status_code == 200
        assert resp.json()["ok"] is True

    def test_long_message_is_accepted(self, client):
        long_msg = "What do you have? " * 200
        with patch("routers.chat.call_gemini_chat", return_value="answer"):
            resp = client.post("/chat/message", json={"message": long_msg})
        assert resp.status_code == 200
        assert resp.json()["ok"] is True
