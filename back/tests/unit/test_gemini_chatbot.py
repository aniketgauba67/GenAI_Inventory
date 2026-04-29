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


def _mock_pantry(pantry_id: int, name: str, location: str, is_open: bool = True):
    return SimpleNamespace(id=pantry_id, name=name, location=location, is_open=is_open)


def _mock_pantry_session(pantries):
    mock_session = MagicMock()
    mock_query = MagicMock()
    mock_query.order_by.return_value.all.return_value = pantries
    mock_session.query.return_value = mock_query
    return mock_session


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


def test_nearest_pantry_without_location_asks_for_zip_or_city():
    mock_session = _mock_pantry_session([
        _mock_pantry(1, "FPN Market", "131 McMillen Dr, Newark, OH 43055"),
    ])

    with patch("database.SessionLocal", return_value=mock_session):
        reply = gemini_chatbot.call_gemini_chat(
            user_message="What is the closest pantry near me?",
            pantry_id=1,
        )

    assert reply is not None
    assert "do not have access to your live geographic location" in reply
    assert "ZIP code" in reply
    mock_session.close.assert_called_once()


def test_nearest_pantry_by_zip_uses_all_pantry_locations():
    mock_session = _mock_pantry_session([
        _mock_pantry(1, "FPN Market at LMHS", "131 McMillen Dr, Newark, OH 43055"),
        _mock_pantry(2, "Pataskala UMC", "458 South Main St, Pataskala, OH 43062"),
    ])

    with patch("database.SessionLocal", return_value=mock_session):
        reply = gemini_chatbot.call_gemini_chat(
            user_message="closest pantry near 43062",
            pantry_id=1,
        )

    assert reply is not None
    assert "ZIP code 43062" in reply
    assert "Pataskala UMC" in reply
    assert "FPN Market at LMHS" not in reply


def test_nearest_pantry_by_city_uses_all_pantry_locations():
    mock_session = _mock_pantry_session([
        _mock_pantry(1, "FPN Market at LMHS", "131 McMillen Dr, Newark, OH 43055"),
        _mock_pantry(2, "Heath Fire Department", "93 Heath Rd, Heath, OH 43056", is_open=False),
    ])

    with patch("database.SessionLocal", return_value=mock_session):
        reply = gemini_chatbot.call_gemini_chat(
            user_message="nearest pantry in Heath",
            pantry_id=1,
        )

    assert reply is not None
    assert "based on Heath" in reply
    assert "Heath Fire Department" in reply
    assert "closed" in reply
    assert "FPN Market at LMHS" not in reply
