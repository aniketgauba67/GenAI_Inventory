"""Tests for pantry operating-hours validation helpers."""

import unittest

from back.operating_hours import normalize_operating_hours
from back.schemas import OperatingHourSlot


class TestAuthScheduleValidation(unittest.TestCase):
    def test_normalize_operating_hours_accepts_and_sorts_valid_rows(self) -> None:
        normalized, error = normalize_operating_hours(
            [
                OperatingHourSlot(day="wed", open="13:00", close="15:00"),
                OperatingHourSlot(day="mon", open="09:00", close="11:00"),
                OperatingHourSlot(day="mon", open="12:00", close="14:00"),
            ]
        )

        self.assertIsNone(error)
        self.assertEqual(
            normalized,
            [
                {"day": "mon", "open": "09:00", "close": "11:00"},
                {"day": "mon", "open": "12:00", "close": "14:00"},
                {"day": "wed", "open": "13:00", "close": "15:00"},
            ],
        )

    def test_normalize_operating_hours_rejects_invalid_day(self) -> None:
        normalized, error = normalize_operating_hours(
            [OperatingHourSlot(day="monday", open="09:00", close="11:00")]
        )

        self.assertEqual(normalized, [])
        self.assertEqual(error, "Row 1: day must be one of mon, tue, wed, thu, fri, sat, sun.")

    def test_normalize_operating_hours_rejects_close_before_open(self) -> None:
        normalized, error = normalize_operating_hours(
            [OperatingHourSlot(day="mon", open="14:00", close="09:00")]
        )

        self.assertEqual(normalized, [])
        self.assertEqual(error, "Row 1: close time must be later than open time.")


if __name__ == "__main__":
    unittest.main()
