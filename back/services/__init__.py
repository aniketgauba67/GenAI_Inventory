"""******************************* __init__.py ***************************************
 *
 *  Module: Backend Service
 *
 *  This module contains backend integration logic for the GenAI Inventory
 *  API.
 *
 *  The module provides:
 *
 *  - service-level helpers used by routers.
 *  - external API or business-logic integration.
 *
 *  Key Structures Used:
 *
 *  - service functions, prompt text, and normalized data dictionaries.
 *
 *  This module ensures:
 *
 *  - routers stay focused on HTTP concerns.
 *  - integration behavior is reusable and testable.
 *
 *  Editors: Aniket, Dipankar, Liam, Jin, and Philip.
 *
 ****************************************************************************
"""

from back.services.gemini import call_gemini_inventory, call_gemini_inventory_images
from back.services.gemini_chatbot import call_gemini_chat, run_interactive_chatbot

__all__ = [
	"call_gemini_inventory",
	"call_gemini_inventory_images",
	"call_gemini_chat",
	"run_interactive_chatbot",
]
