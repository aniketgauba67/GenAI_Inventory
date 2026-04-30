"""******************************* test_gemini_chatbot.py ***************************************
 *
 *  Module: Backend Unit Test Gemini Chatbot Test
 *
 *  This module defines automated backend checks for backend unit test gemini chatbot test.
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
 *  Editors: Aniket, Dipankar, Liam, Jin, and Philip.
 *
 ****************************************************************************
"""
from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from back.services import gemini_chatbot


def _mock_pantry(pantry_id: int, name: str, location: str, is_open: bool = True):
    return SimpleNamespace(
        id=pantry_id,
        name=name,
        location=location,
        is_open=is_open,
        operating_hours=[{"day": "fri", "open": "09:30", "close": "10:30"}],
    )


def _mock_pantry_session(pantries):
    mock_session = MagicMock()
    mock_query = MagicMock()
    mock_query.order_by.return_value.all.return_value = pantries
    mock_session.query.return_value = mock_query
    return mock_session


def test_pantry_count_question_ignores_selected_pantry_scope():
    mock_session = MagicMock()
    mock_session.query.return_value.count.return_value = 27

    with patch.object(gemini_chatbot, "SessionLocal", return_value=mock_session):
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

    with patch.object(gemini_chatbot, "SessionLocal", return_value=mock_session):
        reply = gemini_chatbot.call_gemini_chat(
            user_message="What is the closest pantry near me?",
            pantry_id=1,
        )

    assert reply is not None
    assert "browser location" in reply
    assert "not shared" in reply
    assert "ZIP code" in reply
    mock_session.close.assert_called_once()


def test_nearest_pantry_by_zip_uses_all_pantry_locations():
    mock_session = _mock_pantry_session([
        _mock_pantry(1, "FPN Market at LMHS", "131 McMillen Dr, Newark, OH 43055"),
        _mock_pantry(2, "Pataskala UMC", "458 South Main St, Pataskala, OH 43062"),
    ])

    with patch.object(gemini_chatbot, "SessionLocal", return_value=mock_session):
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

    with patch.object(gemini_chatbot, "SessionLocal", return_value=mock_session):
        reply = gemini_chatbot.call_gemini_chat(
            user_message="nearest pantry in Heath",
            pantry_id=1,
        )

    assert reply is not None
    assert "Based on Heath" in reply
    assert "Heath Fire Department" in reply
    assert "closed" in reply
    assert "FPN Market at LMHS" not in reply


def test_nearest_pantry_with_user_location_returns_distance_and_details():
    mock_session = _mock_pantry_session([
        _mock_pantry(1, "FPN Market at LMHS", "131 McMillen Dr, Newark, OH 43055"),
        _mock_pantry(2, "Heath Fire Department (Thanksgiving-Easter)", "93 Heath Rd, Heath, OH 43056", is_open=False),
        _mock_pantry(3, "Johnstown/Faithcare Pantry", "140 Pratt St, Johnstown, OH 43031"),
    ])

    with patch.object(gemini_chatbot, "SessionLocal", return_value=mock_session):
        reply = gemini_chatbot.call_gemini_chat(
            user_message="What is the closest pantry near me?",
            pantry_id=1,
            user_location={"latitude": 40.0200, "longitude": -82.4450, "accuracy": 40},
        )

    assert reply is not None
    assert "Using your shared location" in reply
    assert "Heath Fire Department" in reply
    assert "miles away" in reply
    assert "93 Heath Rd" in reply
    assert "Hours: Fri 09:30-10:30" in reply
    assert "Distances are approximate" in reply


def test_nearest_pantry_typo_with_user_location_still_returns_distance():
    mock_session = _mock_pantry_session([
        _mock_pantry(1, "FPN Market at LMHS", "131 McMillen Dr, Newark, OH 43055"),
        _mock_pantry(2, "Heath Fire Department (Thanksgiving-Easter)", "93 Heath Rd, Heath, OH 43056", is_open=False),
    ])

    with patch.object(gemini_chatbot, "SessionLocal", return_value=mock_session):
        reply = gemini_chatbot.call_gemini_chat(
            user_message="find nearest patry near me",
            pantry_id=1,
            user_location={"latitude": 40.0200, "longitude": -82.4450, "accuracy": 40},
        )

    assert reply is not None
    assert "Using your shared location" in reply
    assert "Heath Fire Department" in reply
    assert "miles away" in reply
