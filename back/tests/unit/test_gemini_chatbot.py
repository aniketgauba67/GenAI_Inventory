from __future__ import annotations

import sys
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from back.services import gemini_chatbot

ROOT_DIR = Path(__file__).resolve().parents[3]
DB_DIR = ROOT_DIR / "db"
if str(DB_DIR) not in sys.path:
    sys.path.insert(0, str(DB_DIR))


def test_pantry_count_question_ignores_selected_pantry_scope():
    mock_session = MagicMock()
    mock_session.query.return_value.count.return_value = 27

    with patch("database.SessionLocal", return_value=mock_session):
        reply = gemini_chatbot.call_gemini_chat(
            user_message="How many pantries are there?",
            pantry_id=1,
        )

    assert reply == "There are 27 pantries in the system."
    mock_session.close.assert_called_once()


def test_global_pantry_question_fetches_unscoped_context():
    captured = {}
    mock_model = MagicMock()
    mock_model.invoke.return_value = SimpleNamespace(content="Here are the pantries.")

    def fake_context(*, pantry_id=None):
        captured["pantry_id"] = pantry_id
        return '{"pantries": []}'

    with (
        patch.object(gemini_chatbot, "_build_chat_model", return_value=mock_model),
        patch.object(gemini_chatbot, "_fetch_db_chat_context", side_effect=fake_context),
    ):
        reply = gemini_chatbot.call_gemini_chat(
            user_message="List all pantries",
            pantry_id=1,
        )

    assert reply == "Here are the pantries."
    assert captured["pantry_id"] is None


def test_inventory_question_keeps_selected_pantry_context():
    captured = {}
    mock_model = MagicMock()
    mock_model.invoke.return_value = SimpleNamespace(content="Inventory answer.")

    def fake_context(*, pantry_id=None):
        captured["pantry_id"] = pantry_id
        return '{"pantries": []}'

    with (
        patch.object(gemini_chatbot, "_build_chat_model", return_value=mock_model),
        patch.object(gemini_chatbot, "_fetch_db_chat_context", side_effect=fake_context),
    ):
        reply = gemini_chatbot.call_gemini_chat(
            user_message="What is low in this pantry?",
            pantry_id=1,
        )

    assert reply == "Inventory answer."
    assert captured["pantry_id"] == 1
