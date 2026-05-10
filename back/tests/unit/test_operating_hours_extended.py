"""******************************* test_operating_hours_extended.py ***************************************
 *
 *  Module: Backend Unit Test Operating Hours Extended Test
 *
 *  This module defines automated backend checks for backend unit test operating hours extended test.
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

from back.operating_hours import normalize_operating_hours, parse_hhmm


# ── parse_hhmm ────────────────────────────────────────────────────────────────

class TestParseHhmm(unittest.TestCase):

    def test_valid_times(self):
        self.assertEqual(parse_hhmm("00:00"), 0)
        self.assertEqual(parse_hhmm("09:00"), 540)
        self.assertEqual(parse_hhmm("12:30"), 750)
        self.assertEqual(parse_hhmm("23:59"), 1439)
        self.assertEqual(parse_hhmm("17:00"), 1020)

    def test_invalid_hour_too_large(self):
        self.assertIsNone(parse_hhmm("24:00"))

    def test_invalid_minute_too_large(self):
        self.assertIsNone(parse_hhmm("12:60"))

    def test_negative_hour(self):
        self.assertIsNone(parse_hhmm("-1:00"))

    def test_non_numeric_string(self):
        self.assertIsNone(parse_hhmm("abc"))

    def test_missing_separator(self):
        self.assertIsNone(parse_hhmm("0900"))

    def test_empty_string(self):
        self.assertIsNone(parse_hhmm(""))

    def test_none_value(self):
        self.assertIsNone(parse_hhmm(None))  # type: ignore[arg-type]


# ── normalize_operating_hours ────────────────────────────────────────────────

class TestNormalizeOperatingHours(unittest.TestCase):

    def _ok(self, hours, expected_count=None):
        normalized, err = normalize_operating_hours(hours)
        self.assertIsNone(err, msg=f"Expected no error but got: {err}")
        if expected_count is not None:
            self.assertEqual(len(normalized), expected_count)
        return normalized

    def _err(self, hours):
        normalized, err = normalize_operating_hours(hours)
        self.assertEqual(normalized, [], "Should return empty list on error")
        self.assertIsNotNone(err)
        return err

    # --- Valid inputs ---

    def test_empty_list_is_valid(self):
        normalized = self._ok([], expected_count=0)
        self.assertEqual(normalized, [])

    def test_single_valid_slot(self):
        slots = [{"day": "mon", "open": "09:00", "close": "17:00"}]
        normalized = self._ok(slots, expected_count=1)
        self.assertEqual(normalized[0]["day"], "mon")

    def test_valid_full_week(self):
        slots = [
            {"day": day, "open": "09:00", "close": "17:00"}
            for day in ["sun", "sat", "fri", "thu", "wed", "tue", "mon"]
        ]
        normalized = self._ok(slots, expected_count=7)
        # Must be sorted by DAY_ORDER
        days = [s["day"] for s in normalized]
        self.assertEqual(days, ["mon", "tue", "wed", "thu", "fri", "sat", "sun"])

    def test_day_names_are_case_insensitive(self):
        slots = [{"day": "MON", "open": "09:00", "close": "17:00"}]
        normalized = self._ok(slots, expected_count=1)
        self.assertEqual(normalized[0]["day"], "mon")

    def test_day_names_with_spaces_are_stripped(self):
        slots = [{"day": "  tue  ", "open": "09:00", "close": "17:00"}]
        normalized = self._ok(slots, expected_count=1)
        self.assertEqual(normalized[0]["day"], "tue")

    def test_multiple_slots_same_day_are_sorted_by_open_time(self):
        slots = [
            {"day": "mon", "open": "14:00", "close": "18:00"},
            {"day": "mon", "open": "09:00", "close": "12:00"},
        ]
        normalized = self._ok(slots, expected_count=2)
        self.assertEqual(normalized[0]["open"], "09:00")
        self.assertEqual(normalized[1]["open"], "14:00")

    def test_slot_as_object_with_attributes(self):
        """normalize_operating_hours accepts attribute-style objects too."""
        from types import SimpleNamespace
        slot = SimpleNamespace(day="fri", open="08:00", close="16:00")
        normalized = self._ok([slot], expected_count=1)
        self.assertEqual(normalized[0]["day"], "fri")

    # --- Invalid inputs ---

    def test_invalid_day_name(self):
        slots = [{"day": "monday", "open": "09:00", "close": "17:00"}]
        err = self._err(slots)
        self.assertIn("mon", err.lower())

    def test_invalid_open_time_format(self):
        slots = [{"day": "mon", "open": "9:00am", "close": "17:00"}]
        err = self._err(slots)
        self.assertIn("HH:MM", err)

    def test_close_before_open(self):
        slots = [{"day": "mon", "open": "17:00", "close": "09:00"}]
        err = self._err(slots)
        self.assertIn("close time", err.lower())

    def test_close_equal_to_open(self):
        slots = [{"day": "mon", "open": "09:00", "close": "09:00"}]
        err = self._err(slots)
        self.assertIn("close time", err.lower())

    def test_midnight_open_and_close(self):
        slots = [{"day": "mon", "open": "00:00", "close": "23:59"}]
        normalized = self._ok(slots, expected_count=1)
        self.assertEqual(normalized[0]["open"], "00:00")

    def test_error_message_includes_row_index(self):
        slots = [
            {"day": "mon", "open": "09:00", "close": "17:00"},
            {"day": "invalid", "open": "09:00", "close": "17:00"},
        ]
        err = self._err(slots)
        self.assertIn("Row 2", err)

    def test_null_day_value_fails(self):
        slots = [{"day": None, "open": "09:00", "close": "17:00"}]
        err = self._err(slots)
        self.assertIsNotNone(err)

    def test_missing_keys_fail(self):
        slots = [{"day": "mon", "open": "09:00"}]   # missing close
        err = self._err(slots)
        self.assertIsNotNone(err)


if __name__ == "__main__":
    unittest.main()
