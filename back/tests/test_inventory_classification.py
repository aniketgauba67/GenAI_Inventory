"""Boundary tests for Sprint 1 inventory classification."""

import asyncio
import json
import tempfile
import unittest
from io import BytesIO
from pathlib import Path
from unittest.mock import patch

from back.inventory_processing import (
    CATEGORY_KEYS,
    build_classification_artifact,
    build_comparison_artifact,
    build_inventory_map,
    build_required_output,
    classify_percentage,
    write_json,
)
from back.inventory_pipeline import process_inventory_payload

try:
    from fastapi import UploadFile
    from back.routers.upload import upload_images
    FASTAPI_AVAILABLE = True
except ModuleNotFoundError:
    UploadFile = None
    upload_images = None
    FASTAPI_AVAILABLE = False


class TestInventoryClassificationBoundaries(unittest.TestCase):
    """Verify exact threshold behavior for High/Medium/Low."""

    def test_70_is_medium(self) -> None:
        self.assertEqual(classify_percentage(70), "Medium")

    def test_30_is_low(self) -> None:
        self.assertEqual(classify_percentage(30), "Low")

    def test_71_is_high(self) -> None:
        self.assertEqual(classify_percentage(71), "High")

    def test_31_is_medium(self) -> None:
        self.assertEqual(classify_percentage(31), "Medium")

    def test_required_output_keeps_exact_categories(self) -> None:
        payload = build_required_output(
            {
                "ok": True,
                "count": 2,
                "files": [],
                "rawInventory": {"Cereal": 86},
            }
        )

        self.assertEqual(list(payload["inventory"].keys()), CATEGORY_KEYS)
        self.assertEqual(payload["inventory"]["Cereal"], 86)
        self.assertTrue(all(payload["inventory"][key] == 0 for key in CATEGORY_KEYS if key != "Cereal"))

    def test_build_inventory_map_coerces_types_and_fills_missing_categories(self) -> None:
        inventory = build_inventory_map(
            {
                "Cereal": "86",
                "Juices": 31.9,
                "Snacks": 5,
            }
        )

        self.assertEqual(list(inventory.keys()), CATEGORY_KEYS)
        self.assertEqual(inventory["Cereal"], 86)
        self.assertEqual(inventory["Juices"], 31)
        self.assertEqual(inventory["Snacks"], 5)
        self.assertEqual(inventory["Beverages"], 0)

    def test_required_output_uses_default_count_and_file_flags(self) -> None:
        payload = build_required_output(
            {
                "files": [
                    {
                        "filename": "a.jpg",
                        "content_type": "image/jpeg",
                        "size_bytes": "10",
                    },
                    {
                        "filename": "b.webp",
                        "content_type": "image/webp",
                        "size_bytes": 20,
                        "ok": False,
                    },
                ],
                "rawInventory": {"Cereal": 86},
            }
        )

        self.assertTrue(payload["ok"])
        self.assertEqual(payload["count"], 2)
        self.assertEqual(payload["files"][0]["size_bytes"], 10)
        self.assertTrue(payload["files"][0]["ok"])
        self.assertFalse(payload["files"][1]["ok"])
        self.assertEqual(payload["inventory"]["Cereal"], 86)

    def test_required_output_matches_expected_exact_structure(self) -> None:
        payload = build_required_output(
            {
                "ok": True,
                "count": 2,
                "files": [
                    {
                        "filename": "full-shelves-at-walmart-supermarket-different-kinds-of-cornflakes-cereals-nevada-usa-2CBPC1C.jpg",
                        "content_type": "image/jpeg",
                        "size_bytes": 381190,
                        "ok": True,
                    },
                    {
                        "filename": "walmart-various-cereals-shelf-north-augusta-sc-usa-422074193.jpg.webp",
                        "content_type": "image/webp",
                        "size_bytes": 331704,
                        "ok": True,
                    },
                ],
                "rawInventory": {"Cereal": 86},
            }
        )

        expected = {
            "ok": True,
            "count": 2,
            "files": [
                {
                    "filename": "full-shelves-at-walmart-supermarket-different-kinds-of-cornflakes-cereals-nevada-usa-2CBPC1C.jpg",
                    "content_type": "image/jpeg",
                    "size_bytes": 381190,
                    "ok": True,
                },
                {
                    "filename": "walmart-various-cereals-shelf-north-augusta-sc-usa-422074193.jpg.webp",
                    "content_type": "image/webp",
                    "size_bytes": 331704,
                    "ok": True,
                },
            ],
            "inventory": {category: 0 for category in CATEGORY_KEYS},
        }
        expected["inventory"]["Cereal"] = 86

        self.assertEqual(payload, expected)

    def test_classification_artifact_summary(self) -> None:
        classification = build_classification_artifact(
            {
                "inventory": {
                    "Beverages": 0,
                    "Juices": 31,
                    "Cereal": 86,
                    "Breakfast": 70,
                    "Meat": 0,
                    "Fish": 0,
                    "Poultry": 0,
                    "Frozen": 0,
                    "Vegetables": 0,
                    "Fruits": 0,
                    "Nuts": 0,
                    "Soup": 0,
                    "Grains": 0,
                    "Pasta": 0,
                    "Snacks": 0,
                    "Spices": 0,
                    "Sauces": 0,
                    "Condiments": 0,
                    "Misc Products": 0,
                }
            }
        )

        self.assertEqual(classification["classification"]["Cereal"], "High")
        self.assertEqual(classification["classification"]["Juices"], "Medium")
        self.assertEqual(classification["classification"]["Breakfast"], "Medium")
        self.assertEqual(classification["classification"]["Beverages"], "Low")
        self.assertEqual(classification["summaryCounts"], {"High": 1, "Medium": 2, "Low": 16})

    def test_comparison_artifact_uses_previous_inventory(self) -> None:
        comparison = build_comparison_artifact(
            {
                "Beverages": 0,
                "Juices": 30,
                "Cereal": 86,
                "Breakfast": 0,
                "Meat": 0,
                "Fish": 0,
                "Poultry": 0,
                "Frozen": 0,
                "Vegetables": 0,
                "Fruits": 0,
                "Nuts": 0,
                "Soup": 0,
                "Grains": 0,
                "Pasta": 0,
                "Snacks": 0,
                "Spices": 0,
                "Sauces": 0,
                "Condiments": 0,
                "Misc Products": 0,
            },
            {
                "Beverages": 0,
                "Juices": 20,
                "Cereal": 43,
                "Breakfast": 0,
                "Meat": 0,
                "Fish": 0,
                "Poultry": 0,
                "Frozen": 0,
                "Vegetables": 0,
                "Fruits": 0,
                "Nuts": 0,
                "Soup": 0,
                "Grains": 0,
                "Pasta": 0,
                "Snacks": 0,
                "Spices": 0,
                "Sauces": 0,
                "Condiments": 0,
                "Misc Products": 0,
            },
        )

        self.assertEqual(comparison["previousInventory"]["Cereal"], 43)
        self.assertEqual(comparison["delta"]["Cereal"], 43)
        self.assertEqual(comparison["percentageChange"]["Cereal"], 100.0)
        self.assertEqual(comparison["percentageChange"]["Juices"], 50.0)
        self.assertEqual(comparison["percentageChange"]["Beverages"], 0.0)

    def test_comparison_artifact_handles_decrease_and_zero_baseline_cases(self) -> None:
        comparison = build_comparison_artifact(
            {
                "Beverages": 5,
                "Juices": 0,
                "Cereal": 40,
                "Breakfast": 0,
                "Meat": 0,
                "Fish": 0,
                "Poultry": 0,
                "Frozen": 0,
                "Vegetables": 0,
                "Fruits": 0,
                "Nuts": 0,
                "Soup": 0,
                "Grains": 0,
                "Pasta": 0,
                "Snacks": 0,
                "Spices": 0,
                "Sauces": 0,
                "Condiments": 0,
                "Misc Products": 0,
            },
            {
                "Beverages": 0,
                "Juices": 10,
                "Cereal": 80,
                "Breakfast": 0,
                "Meat": 0,
                "Fish": 0,
                "Poultry": 0,
                "Frozen": 0,
                "Vegetables": 0,
                "Fruits": 0,
                "Nuts": 0,
                "Soup": 0,
                "Grains": 0,
                "Pasta": 0,
                "Snacks": 0,
                "Spices": 0,
                "Sauces": 0,
                "Condiments": 0,
                "Misc Products": 0,
            },
        )

        self.assertEqual(comparison["delta"]["Cereal"], -40)
        self.assertEqual(comparison["percentageChange"]["Cereal"], -50.0)
        self.assertEqual(comparison["delta"]["Juices"], -10)
        self.assertEqual(comparison["percentageChange"]["Juices"], -100.0)
        self.assertEqual(comparison["delta"]["Beverages"], 5)
        self.assertIsNone(comparison["percentageChange"]["Beverages"])

    def test_comparison_artifact_handles_missing_previous_inventory(self) -> None:
        comparison = build_comparison_artifact(
            {category: 0 for category in CATEGORY_KEYS},
            None,
        )

        self.assertIsNone(comparison["previousInventory"])
        self.assertIsNone(comparison["percentageChange"]["Cereal"])
        self.assertEqual(comparison["delta"]["Cereal"], 0)

    def test_write_json_creates_parent_directory_and_writes_expected_content(self) -> None:
        payload = {"ok": True, "count": 2}

        with tempfile.TemporaryDirectory() as temp_dir:
            output_path = Path(temp_dir) / "nested" / "output.json"
            write_json(output_path, payload)

            self.assertTrue(output_path.exists())
            self.assertEqual(json.loads(output_path.read_text(encoding="utf-8")), payload)

    @patch("back.inventory_pipeline.should_dry_run", return_value=True)
    def test_process_inventory_payload_writes_artifacts_in_dry_run(self, _: object) -> None:
        required_output = build_required_output(
            {
                "ok": True,
                "count": 1,
                "files": [
                    {
                        "filename": "image.jpg",
                        "content_type": "image/jpeg",
                        "size_bytes": 123,
                        "ok": True,
                    }
                ],
                "rawInventory": {"Cereal": 86},
            }
        )

        with tempfile.TemporaryDirectory() as temp_dir:
            result = process_inventory_payload(required_output, output_dir=Path(temp_dir))

            self.assertTrue(result["persistence"]["dryRun"])
            self.assertTrue((Path(temp_dir) / "mock_inventory_output.json").exists())
            self.assertTrue((Path(temp_dir) / "mock_inventory_levels.json").exists())
            self.assertEqual(result["levelsArtifact"]["classification"]["Cereal"], "High")

    @unittest.skipUnless(FASTAPI_AVAILABLE, "fastapi is not installed")
    @patch("back.routers.upload.process_inventory_payload")
    @patch("back.routers.upload.save_inventory_draft")
    @patch("back.routers.upload.call_gemini_inventory")
    def test_upload_route_runs_pipeline_and_saves_draft(
        self,
        mock_gemini: object,
        mock_save_draft: object,
        mock_process_payload: object,
    ) -> None:
        mock_gemini.return_value = {category: 0 for category in CATEGORY_KEYS}
        mock_gemini.return_value["Cereal"] = 86
        mock_process_payload.return_value = {
            "persistence": {"dryRun": True, "wouldPersist": {}},
            "previousInventoryLookupError": None,
        }

        upload_file = UploadFile(
            filename="shelf.jpg",
            file=BytesIO(b"fake-image-bytes"),
            headers={"content-type": "image/jpeg"},
        )

        response = asyncio.run(upload_images(files=[upload_file], pantry_id="pantry-1"))

        self.assertTrue(response["ok"])
        self.assertEqual(response["inventory"]["Cereal"], 86)
        mock_process_payload.assert_called_once()
        mock_save_draft.assert_called_once()
        saved_args = mock_save_draft.call_args[0]
        self.assertEqual(saved_args[0], "pantry-1")
        self.assertEqual(saved_args[1]["Cereal"], 86)
        self.assertEqual(saved_args[2][0]["filename"], "shelf.jpg")


if __name__ == "__main__":
    unittest.main()
