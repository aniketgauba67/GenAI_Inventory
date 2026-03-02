"""Sprint 1 entry point for mock detection processing and AWS persistence."""

from __future__ import annotations

import json
import sys
from pathlib import Path

from dotenv import load_dotenv

try:
    from .inventory_processing import (
        build_required_output,
        load_json,
    )
    from .inventory_pipeline import process_inventory_payload
except ImportError:
    from inventory_processing import (
        build_required_output,
        load_json,
    )
    from inventory_pipeline import process_inventory_payload


def main() -> None:
    """Read mock input, generate required outputs, and optionally persist the run."""
    load_dotenv()

    base_dir = Path(__file__).resolve().parent
    input_path = base_dir / "data" / "mock_detection_result.json"
    output_dir = base_dir / "output"

    mock_input = load_json(input_path)
    required_output = build_required_output(mock_input)
    result = process_inventory_payload(required_output, output_dir=output_dir)

    if result["previousInventoryLookupError"] is not None:
        print(
            json.dumps(
                {
                    "previousInventoryLookup": "skipped",
                    "reason": result["previousInventoryLookupError"],
                },
                indent=2,
            ),
            file=sys.stderr,
        )

    print(json.dumps(result["persistence"], indent=2), file=sys.stderr)

    print(json.dumps(required_output, indent=2))


if __name__ == "__main__":
    main()
