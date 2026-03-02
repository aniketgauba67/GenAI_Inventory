"""Shared inventory processing pipeline for scripts and live uploads."""

from __future__ import annotations

from pathlib import Path
from typing import Any

try:
    from .aws_persistence import (
        build_run_record,
        fetch_latest_inventory_snapshot,
        persist_inventory_run,
        should_dry_run,
    )
    from .inventory_processing import (
        build_classification_artifact,
        build_comparison_artifact,
        write_json,
    )
except ImportError:
    from aws_persistence import (
        build_run_record,
        fetch_latest_inventory_snapshot,
        persist_inventory_run,
        should_dry_run,
    )
    from inventory_processing import (
        build_classification_artifact,
        build_comparison_artifact,
        write_json,
    )


def process_inventory_payload(
    required_output: dict[str, Any],
    output_dir: Path | None = None,
    dry_run: bool | None = None,
) -> dict[str, Any]:
    """Classify, compare, persist, and optionally write artifacts for one inventory payload."""
    resolved_dry_run = should_dry_run() if dry_run is None else dry_run
    classification_artifact = build_classification_artifact(required_output)
    previous_inventory = None
    previous_lookup_error: str | None = None

    if not resolved_dry_run:
        try:
            previous_inventory = fetch_latest_inventory_snapshot()
        except Exception as exc:
            previous_lookup_error = str(exc)

    comparison_artifact = build_comparison_artifact(
        required_output["inventory"],
        previous_inventory,
    )
    levels_artifact = {
        **classification_artifact,
        **comparison_artifact,
    }
    run_record = build_run_record(required_output, classification_artifact, comparison_artifact)

    if output_dir is not None:
        write_json(output_dir / "mock_inventory_output.json", required_output)
        write_json(output_dir / "mock_inventory_levels.json", levels_artifact)

    persistence: dict[str, Any]
    if resolved_dry_run:
        persistence = {
            "dryRun": True,
            "wouldPersist": run_record,
        }
    else:
        try:
            persisted_run_id = persist_inventory_run(run_record)
            persistence = {
                "dryRun": False,
                "persistedRunId": persisted_run_id,
            }
        except Exception as exc:
            persistence = {
                "dryRunFallback": True,
                "reason": str(exc),
                "wouldPersist": run_record,
            }

    return {
        "requiredOutput": required_output,
        "levelsArtifact": levels_artifact,
        "runRecord": run_record,
        "persistence": persistence,
        "previousInventoryLookupError": previous_lookup_error,
    }
