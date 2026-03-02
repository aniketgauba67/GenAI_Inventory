"""Sprint 1 entry point for mock detection processing and AWS persistence."""

from __future__ import annotations

import json
import sys
from pathlib import Path

from dotenv import load_dotenv

from aws_persistence import (
    build_run_record,
    fetch_latest_inventory_snapshot,
    persist_inventory_run,
    should_dry_run,
)
from inventory_processing import (
    build_classification_artifact,
    build_comparison_artifact,
    build_required_output,
    load_json,
    write_json,
)


def main() -> None:
    """Read mock input, generate required outputs, and optionally persist the run."""
    load_dotenv()

    base_dir = Path(__file__).resolve().parent
    input_path = base_dir / "data" / "mock_detection_result.json"
    output_dir = base_dir / "output"
    output_path = output_dir / "mock_inventory_output.json"
    levels_path = output_dir / "mock_inventory_levels.json"
    dry_run = should_dry_run()

    mock_input = load_json(input_path)
    required_output = build_required_output(mock_input)
    classification_artifact = build_classification_artifact(required_output)
    previous_inventory = None

    if not dry_run:
        try:
            previous_inventory = fetch_latest_inventory_snapshot()
        except Exception as exc:
            print(
                json.dumps(
                    {
                        "previousInventoryLookup": "skipped",
                        "reason": str(exc),
                    },
                    indent=2,
                ),
                file=sys.stderr,
            )

    comparison_artifact = build_comparison_artifact(
        required_output["inventory"],
        previous_inventory,
    )
    levels_artifact = {
        **classification_artifact,
        **comparison_artifact,
    }
    run_record = build_run_record(required_output, classification_artifact, comparison_artifact)

    write_json(output_path, required_output)
    write_json(levels_path, levels_artifact)

    if dry_run:
        print(
            json.dumps(
                {
                    "dryRun": True,
                    "wouldPersist": run_record,
                },
                indent=2,
            ),
            file=sys.stderr,
        )
    else:
        try:
            persisted_run_id = persist_inventory_run(run_record)
            print(
                json.dumps(
                    {
                        "dryRun": False,
                        "persistedRunId": persisted_run_id,
                    },
                    indent=2,
                ),
                file=sys.stderr,
            )
        except Exception as exc:
            print(
                json.dumps(
                    {
                        "dryRunFallback": True,
                        "reason": str(exc),
                        "wouldPersist": run_record,
                    },
                    indent=2,
                ),
                file=sys.stderr,
            )

    print(json.dumps(required_output, indent=2))


if __name__ == "__main__":
    main()
