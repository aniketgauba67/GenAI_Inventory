"""Helpers for pantry operating-hours validation and normalization."""

from __future__ import annotations

VALID_OPERATING_DAYS = {"mon", "tue", "wed", "thu", "fri", "sat", "sun"}
DAY_ORDER = {"mon": 0, "tue": 1, "wed": 2, "thu": 3, "fri": 4, "sat": 5, "sun": 6}


def _slot_value(slot, key: str) -> str | None:
    if isinstance(slot, dict):
        value = slot.get(key)
    else:
        value = getattr(slot, key, None)
    return None if value is None else str(value)


def parse_hhmm(value: str) -> int | None:
    try:
        hour_text, minute_text = value.split(":")
        hour = int(hour_text)
        minute = int(minute_text)
    except (ValueError, AttributeError):
        return None

    if hour < 0 or hour > 23 or minute < 0 or minute > 59:
        return None
    return hour * 60 + minute


def normalize_operating_hours(operating_hours: list) -> tuple[list[dict[str, str]], str | None]:
    normalized: list[dict[str, str]] = []

    for index, slot in enumerate(operating_hours, start=1):
        day = (_slot_value(slot, "day") or "").strip().lower()
        open_time = (_slot_value(slot, "open") or "").strip()
        close_time = (_slot_value(slot, "close") or "").strip()

        if day not in VALID_OPERATING_DAYS:
            return [], f"Row {index}: day must be one of mon, tue, wed, thu, fri, sat, sun."

        open_minutes = parse_hhmm(open_time)
        close_minutes = parse_hhmm(close_time)
        if open_minutes is None or close_minutes is None:
            return [], f"Row {index}: open and close must use HH:MM format."
        if open_minutes >= close_minutes:
            return [], f"Row {index}: close time must be later than open time."

        normalized.append({"day": day, "open": open_time, "close": close_time})

    normalized.sort(key=lambda slot: (DAY_ORDER[slot["day"]], slot["open"], slot["close"]))
    return normalized, None
