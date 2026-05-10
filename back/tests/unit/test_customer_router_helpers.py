"""******************************* test_customer_router_helpers.py ***************************************
 *
 *  Module: Backend Unit Test Customer Router Helpers Test
 *
 *  This module defines automated backend checks for backend unit test customer router helpers test.
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

import unittest

# Import the private helpers directly from the router module
from back.routers.customer import _is_within_schedule, _time_to_minutes


class TestTimeToMinutes(unittest.TestCase):

    def test_midnight(self):
        self.assertEqual(_time_to_minutes("00:00"), 0)

    def test_nine_am(self):
        self.assertEqual(_time_to_minutes("09:00"), 540)

    def test_noon(self):
        self.assertEqual(_time_to_minutes("12:00"), 720)

    def test_five_pm(self):
        self.assertEqual(_time_to_minutes("17:00"), 1020)

    def test_eleven_fifty_nine(self):
        self.assertEqual(_time_to_minutes("23:59"), 1439)

    def test_invalid_returns_negative_one(self):
        self.assertEqual(_time_to_minutes("invalid"), -1)
        self.assertEqual(_time_to_minutes(""), -1)
        self.assertEqual(_time_to_minutes("9"), -1)


class TestIsWithinSchedule(unittest.TestCase):

    HOURS = [
        {"day": "mon", "open": "09:00", "close": "17:00"},
        {"day": "wed", "open": "10:00", "close": "18:00"},
        {"day": "fri", "open": "08:00", "close": "13:00"},
    ]

    def _minutes(self, hhmm: str) -> int:
        return _time_to_minutes(hhmm)

    def test_within_window_is_true(self):
        self.assertTrue(_is_within_schedule("mon", self._minutes("12:00"), self.HOURS))

    def test_exactly_at_open_is_true(self):
        self.assertTrue(_is_within_schedule("mon", self._minutes("09:00"), self.HOURS))

    def test_exactly_at_close_is_false(self):
        # Close is exclusive: [open, close)
        self.assertFalse(_is_within_schedule("mon", self._minutes("17:00"), self.HOURS))

    def test_one_minute_before_close_is_true(self):
        self.assertTrue(_is_within_schedule("mon", self._minutes("16:59"), self.HOURS))

    def test_one_minute_before_open_is_false(self):
        self.assertFalse(_is_within_schedule("mon", self._minutes("08:59"), self.HOURS))

    def test_day_not_in_schedule_is_false(self):
        self.assertFalse(_is_within_schedule("tue", self._minutes("12:00"), self.HOURS))

    def test_empty_schedule_is_false(self):
        self.assertFalse(_is_within_schedule("mon", self._minutes("12:00"), []))

    def test_correct_day_but_wrong_window(self):
        self.assertFalse(_is_within_schedule("fri", self._minutes("14:00"), self.HOURS))

    def test_multiple_windows_same_day(self):
        hours = [
            {"day": "sat", "open": "09:00", "close": "12:00"},
            {"day": "sat", "open": "14:00", "close": "18:00"},
        ]
        self.assertTrue(_is_within_schedule("sat", self._minutes("10:00"), hours))
        self.assertFalse(_is_within_schedule("sat", self._minutes("13:00"), hours))
        self.assertTrue(_is_within_schedule("sat", self._minutes("16:00"), hours))

    def test_malformed_slot_is_skipped_gracefully(self):
        hours = [
            {"day": "mon", "open": "bad", "close": "17:00"},
            {"day": "mon", "open": "09:00", "close": "17:00"},
        ]
        # Should still find the valid slot
        self.assertTrue(_is_within_schedule("mon", self._minutes("12:00"), hours))


if __name__ == "__main__":
    unittest.main()
