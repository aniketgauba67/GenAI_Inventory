import os
from pathlib import Path

from dotenv import load_dotenv

_BACK_DIR = Path(__file__).resolve().parent
load_dotenv(_BACK_DIR / ".env")

CORS_ORIGINS = ["http://localhost:3000", "http://localhost:3001"]

GEMINI_MODEL = "gemini-2.5-flash"


def get_gemini_api_key() -> str | None:
    return os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
