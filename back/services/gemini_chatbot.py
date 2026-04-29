import logging
from pathlib import Path
import sys
import json
import re

from config import GEMINI_MODEL, get_gemini_api_key

log = logging.getLogger(__name__)

DEFAULT_CHATBOT_SYSTEM_PROMPT = (
    "You are a helpful assistant to answer user questions regarding pantry and inventory operations. "
    "Be concise, practical, and ask clarifying questions when details are missing. "
    "For current inventory questions, use the resolved pantry inventory in the database context as the source of truth. "
    "Do not ask the user to choose between volunteer and warehouse data. "
    "The precedence is fixed: prefer the latest volunteer submission if it is the same time or newer than the latest warehouse snapshot; "
    "otherwise use the latest warehouse snapshot."
)


def _is_pantry_count_question(message: str) -> bool:
    """Return True when the user is asking for the total number of pantries."""
    normalized = re.sub(r"[^a-z0-9\s]", " ", message.lower())
    words = set(normalized.split())
    mentions_pantry = "pantry" in words or "pantries" in words
    asks_count = (
        "count" in words
        or "total" in words
        or "number" in words
        or ("how" in words and "many" in words)
    )
    return mentions_pantry and asks_count


def _is_global_pantry_question(message: str) -> bool:
    """Detect pantry-list/count questions that should not be scoped to one pantry."""
    normalized = re.sub(r"[^a-z0-9\s]", " ", message.lower())
    words = set(normalized.split())
    mentions_pantry = "pantry" in words or "pantries" in words
    asks_global = bool(words & {"all", "list", "show", "available", "total", "count", "number"})
    return mentions_pantry and (asks_global or ("how" in words and "many" in words))


def _is_nearest_pantry_question(message: str) -> bool:
    """Return True when the user is asking for a nearby pantry."""
    normalized = re.sub(r"[^a-z0-9\s]", " ", message.lower())
    words = set(normalized.split())
    mentions_pantry = "pantry" in words or "pantries" in words
    asks_nearest = bool(words & {"nearest", "closest", "nearby"}) or "near me" in normalized
    return mentions_pantry and asks_nearest


def _normalize_location_text(value: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9\s]", " ", value.lower())).strip()


def _pantry_city(location: str | None) -> str | None:
    if not location:
        return None
    parts = [part.strip() for part in location.split(",")]
    if len(parts) >= 2 and parts[1]:
        return parts[1]
    return None


def _format_pantry_options(pantries: list[dict], limit: int = 5) -> str:
    lines = []
    for pantry in pantries[:limit]:
        status = "open" if pantry["isOpen"] else "closed"
        lines.append(f"- {pantry['name']} ({pantry['location']}) is currently marked {status}.")
    extra = len(pantries) - limit
    if extra > 0:
        lines.append(f"- Plus {extra} more matching pantry location(s).")
    return "\n".join(lines)


def _load_pantry_location_rows() -> list[dict]:
    root_dir = Path(__file__).resolve().parents[2]
    db_dir = root_dir / "db"
    if str(db_dir) not in sys.path:
        sys.path.insert(0, str(db_dir))

    session = None
    try:
        from database import SessionLocal  # pyright: ignore[reportMissingImports]
        from models import Pantry  # pyright: ignore[reportMissingImports]

        session = SessionLocal()
        pantries = session.query(Pantry).order_by(Pantry.id.asc()).all()
        return [
            {
                "id": pantry.id,
                "name": pantry.name,
                "location": pantry.location or "Location not listed",
                "isOpen": pantry.is_open,
                "city": _pantry_city(pantry.location),
            }
            for pantry in pantries
        ]
    finally:
        if session is not None:
            session.close()


def _answer_nearest_pantry_question(message: str) -> str | None:
    """Answer nearest-pantry questions using typed ZIP/city because chat has no GPS."""
    if not _is_nearest_pantry_question(message):
        return None

    try:
        pantries = _load_pantry_location_rows()
    except Exception as e:
        log.warning("Could not load pantry locations for chatbot: %s", e)
        return "I cannot load pantry locations right now. Please try again in a moment."

    if not pantries:
        return "I cannot find any pantry locations in the system right now."

    zip_match = re.search(r"\b\d{5}(?:-\d{4})?\b", message)
    if zip_match:
        zip_code = zip_match.group(0)[:5]
        matches = [pantry for pantry in pantries if zip_code in pantry["location"]]
        if matches:
            return (
                f"I do not have live GPS access in chat, but based on ZIP code {zip_code}, "
                "these are the closest matching pantry locations I found:\n"
                f"{_format_pantry_options(matches)}"
            )
        return (
            f"I do not have live GPS access in chat, and I could not match ZIP code {zip_code} "
            "to a pantry location. Try a nearby city name, such as Newark, Heath, Pataskala, or Johnstown."
        )

    normalized_message = _normalize_location_text(message)
    city_matches: list[dict] = []
    for pantry in pantries:
        city = pantry.get("city")
        if city and _normalize_location_text(city) in normalized_message:
            city_matches.append(pantry)

    if city_matches:
        city_name = city_matches[0]["city"]
        return (
            f"I do not have live GPS access in chat, but based on {city_name}, "
            "these are the closest matching pantry locations I found:\n"
            f"{_format_pantry_options(city_matches)}"
        )

    return (
        "I can help find the nearest pantry, but I do not have access to your live geographic location in chat. "
        "Please tell me your ZIP code, city, or address, for example: \"closest pantry near 43055\"."
    )


def _answer_direct_pantry_count() -> str | None:
    """Answer total pantry count deterministically without asking Gemini."""
    root_dir = Path(__file__).resolve().parents[2]
    db_dir = root_dir / "db"
    if str(db_dir) not in sys.path:
        sys.path.insert(0, str(db_dir))

    session = None
    try:
        from database import SessionLocal  # pyright: ignore[reportMissingImports]
        from models import Pantry  # pyright: ignore[reportMissingImports]

        session = SessionLocal()
        count = session.query(Pantry).count()
        if count == 1:
            return "There is 1 pantry in the system."
        return f"There are {count} pantries in the system."
    except Exception as e:
        log.warning("Could not load pantry count for chatbot: %s", e)
        return None
    finally:
        if session is not None:
            session.close()


def _fetch_db_chat_context(pantry_id: int | None = None) -> str | None:
    """Fetch a compact, read-only DB snapshot for retrieval-augmented chat answers."""
    root_dir = Path(__file__).resolve().parents[2]
    db_dir = root_dir / "db"
    if str(db_dir) not in sys.path:
        sys.path.insert(0, str(db_dir))

    session = None
    try:
        from database import SessionLocal  # pyright: ignore[reportMissingImports]
        from models import InventoryItem, InventoryRun, Pantry  # pyright: ignore[reportMissingImports]
        try:
            from ..customer_inventory_state import resolve_customer_inventory_state
            from ..inventory_domain import load_latest_inventory_run
        except ImportError:
            from customer_inventory_state import resolve_customer_inventory_state
            from inventory_domain import load_latest_inventory_run

        session = SessionLocal()

        pantry_query = session.query(Pantry).order_by(Pantry.id.asc())
        if pantry_id is not None:
            pantry_query = pantry_query.filter(Pantry.id == pantry_id)

        pantries = pantry_query.all()
        item_query = session.query(InventoryItem)
        if pantry_id is not None:
            item_query = item_query.filter(InventoryItem.pantry_id == pantry_id)
        items = item_query.all()

        item_levels_by_pantry: dict[int, dict[str, str]] = {}
        item_original_by_pantry: dict[int, dict[str, int]] = {}
        for item in items:
            item_levels_by_pantry.setdefault(item.pantry_id, {})[item.category_name] = str(item.status or "")
            item_original_by_pantry.setdefault(item.pantry_id, {})[item.category_name] = int(item.original_quantity or 0)

        context_payload = {
            "pantries": [
                _build_chat_pantry_snapshot(
                    session,
                    pantry,
                    item_levels_by_pantry.get(pantry.id, {}),
                    item_original_by_pantry.get(pantry.id, {}),
                    resolve_customer_inventory_state,
                    load_latest_inventory_run,
                    InventoryRun,
                )
                for pantry in pantries
            ],
        }
        return json.dumps(context_payload)
    except Exception as e:
        log.warning("Could not load DB context for chatbot: %s", e)
        return None
    finally:
        if session is not None:
            session.close()


def _build_chat_pantry_snapshot(
    session,
    pantry,
    fallback_levels: dict[str, str],
    fallback_original_quantities: dict[str, int],
    resolve_customer_inventory_state,
    load_latest_inventory_run,
    inventory_run_model,
) -> dict:
    """Build one pantry snapshot for customer-facing chat answers."""
    latest_submit = load_latest_inventory_run(session, inventory_run_model, pantry.id, "volunteer-submit")
    latest_warehouse = load_latest_inventory_run(session, inventory_run_model, pantry.id, "warehouse-snapshot")
    resolved = resolve_customer_inventory_state(
        latest_submit,
        latest_warehouse,
        fallback_levels=fallback_levels,
        fallback_original_quantities=fallback_original_quantities,
    )

    return {
        "id": pantry.id,
        "name": pantry.name,
        "location": pantry.location,
        "isOpen": pantry.is_open,
        "operatingHours": pantry.operating_hours or [],
        "inventorySource": resolved["source"],
        "lastUpdated": resolved["lastUpdated"],
        "currentInventory": resolved["currentInventory"],
        "levels": resolved["levels"],
    }


def _build_chat_model():
    """Create a Gemini chat model using the same project-level config pattern."""
    api_key = get_gemini_api_key()
    if not api_key:
        log.warning("GEMINI_API_KEY (or GOOGLE_API_KEY) not set; skipping Gemini call")
        return None

    from langchain_google_genai import ChatGoogleGenerativeAI

    return ChatGoogleGenerativeAI(
        model=GEMINI_MODEL,
        google_api_key=api_key,
    )


def call_gemini_chat(
    user_message: str,
    history: list[tuple[str, str]] | None = None,
    system_prompt: str = DEFAULT_CHATBOT_SYSTEM_PROMPT,
    pantry_id: int | None = None,
    include_db_context: bool = True,
) -> str | None:
    """Send one user turn to Gemini and return the assistant text.

    history format: [("user", "..."), ("assistant", "..."), ...]
    """
    if not user_message.strip():
        return None

    if _is_pantry_count_question(user_message):
        direct_answer = _answer_direct_pantry_count()
        if direct_answer:
            return direct_answer

    nearest_answer = _answer_nearest_pantry_question(user_message)
    if nearest_answer:
        return nearest_answer

    model = _build_chat_model()
    if model is None:
        return None

    try:
        from langchain_core.messages import AIMessage, HumanMessage, SystemMessage

        messages = [SystemMessage(content=system_prompt)]
        if include_db_context:
            context_pantry_id = None if _is_global_pantry_question(user_message) else pantry_id
            db_context = _fetch_db_chat_context(pantry_id=context_pantry_id)
            if db_context:
                messages.append(
                    SystemMessage(
                        content=(
                            "You may use this database snapshot to answer factual questions. "
                            "If data is missing, say so clearly and ask a follow-up question.\n"
                            f"DB_SNAPSHOT_JSON: {db_context}"
                        )
                    )
                )

        if history:
            for role, content in history:
                if role == "assistant":
                    messages.append(AIMessage(content=content))
                else:
                    messages.append(HumanMessage(content=content))

        messages.append(HumanMessage(content=user_message))
        result = model.invoke(messages)

        if result is None:
            return None
        if isinstance(result.content, str):
            return result.content
        return str(result.content)
    except Exception as e:
        err = str(e).lower()
        if "429" in err or "quota" in err or "resource_exhausted" in err:
            log.warning("Gemini rate limit: %s", e)
            return None
        log.exception("Gemini API error: %s", e)
        return None


def run_interactive_chatbot(
    system_prompt: str = DEFAULT_CHATBOT_SYSTEM_PROMPT,
    pantry_id: int | None = None,
) -> None:
    """Run a terminal chatbot loop backed by Gemini."""
    print("Gemini chatbot ready. Type 'exit' or 'quit' to stop.\n")
    history: list[tuple[str, str]] = []

    while True:
        user_input = input("You: ").strip()
        if user_input.lower() in {"exit", "quit"}:
            print("Goodbye!")
            return
        if not user_input:
            continue

        reply = call_gemini_chat(
            user_message=user_input,
            history=history,
            system_prompt=system_prompt,
            pantry_id=pantry_id,
            include_db_context=True,
        )

        if reply is None:
            print("Assistant: Sorry, I couldn't get a response from Gemini right now.")
            continue

        print(f"Assistant: {reply}\n")
        history.append(("user", user_input))
        history.append(("assistant", reply))


if __name__ == "__main__":
    run_interactive_chatbot()
