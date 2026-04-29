"""******************************* config.py ***************************************
 *
 *  Module: Config
 *
 *  This module supports the FastAPI backend for GenAI Inventory.
 *
 *  The module provides:
 *
 *  - backend helper functions or scripts.
 *  - shared runtime behavior for API and maintenance workflows.
 *
 *  Key Structures Used:
 *
 *  - Python modules, environment settings, and database helpers.
 *
 *  This module ensures:
 *
 *  - backend workflows remain organized by responsibility.
 *  - scripts can be run for local debugging and maintenance.
 *
 *  Editors: Aniket, Dipankar, Liam, Jin, and Philip.
 *
 ****************************************************************************
"""

import os
from pathlib import Path

from dotenv import load_dotenv

_BACK_DIR = Path(__file__).resolve().parent
load_dotenv(_BACK_DIR / ".env")

_cors_env = os.environ.get("CORS_ORIGINS", "")
CORS_ORIGINS = (
    [origin.strip() for origin in _cors_env.split(",") if origin.strip()]
    if _cors_env
    else ["http://localhost:3000", "http://localhost:3001"]
)

GEMINI_MODEL = "gemini-2.5-flash"


def get_gemini_api_key() -> str | None:
    """Return the configured Gemini API key.

    Parameters:
        None.

    Returns:
        The first configured API key from `GEMINI_API_KEY` or `GOOGLE_API_KEY`.
        Returns `None` when neither environment variable is set.
    """
    return os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
