import logging
import json
import math
import re
from urllib.parse import quote_plus

from back.config import GEMINI_MODEL, get_gemini_api_key
from back.customer_inventory_state import resolve_customer_inventory_state
from back.inventory_domain import load_latest_inventory_run
from db.database import SessionLocal
from db.models import InventoryItem, InventoryRun, Pantry

log = logging.getLogger(__name__)

DEFAULT_CHATBOT_SYSTEM_PROMPT = (
    "You are a helpful assistant to answer user questions regarding pantry and inventory operations. "
    "Be concise, practical, and ask clarifying questions when details are missing. "
    "For current inventory questions, use the resolved pantry inventory in the database context as the source of truth. "
    "Do not ask the user to choose between volunteer and warehouse data. "
    "The precedence is fixed: prefer the latest volunteer submission if it is the same time or newer than the latest warehouse snapshot; "
    "otherwise use the latest warehouse snapshot."
)

PANTRY_COORDINATES_BY_NAME: dict[str, tuple[float, float]] = {
    "fpn market at lmhs": (40.0640, -82.4270),
    "fpn market on brice st": (40.0476, -82.3896),
    "seventh day adventist": (40.0582, -82.4000),
    "last call ministries": (40.0604, -82.4049),
    "st vincent depaul society": (40.0499, -82.3965),
    "market street pantry": (40.0567, -82.4047),
    "family of faith church": (40.0805, -82.4124),
    "salvation army": (40.0586, -82.3976),
    "second presbyterian church": (40.0596, -82.4033),
    "newark nazarene church": (40.0665, -82.4042),
    "christ cornerstone church": (40.0589, -82.4058),
    "marne church": (40.1045, -82.3724),
    "wright memorial methodist once a month": (40.0774, -82.4126),
    "waters edge buckeye lake": (39.9316, -82.4662),
    "buckeye lake leads": (39.9315, -82.4778),
    "jacksontown umc": (39.9600, -82.3600),
    "pataskala leads": (39.9818, -82.6995),
    "pataskala umc april nov": (39.9943, -82.6745),
    "kirkersville umc march nov": (39.9598, -82.5940),
    "alexandria umc march nov": (40.0880, -82.6126),
    "st alban s fire dept nov march": (40.0890, -82.6090),
    "christ ev lutheran church easter thanksgiving": (40.0276, -82.4385),
    "heath fire department thanksgiving easter": (40.0204, -82.4444),
    "croton church of christ": (40.2383, -82.6884),
    "johnstown faithcare pantry": (40.1518, -82.6858),
    "utica leads": (40.2355, -82.4512),
}

DAY_LABELS = {
    "mon": "Mon",
    "tue": "Tue",
    "wed": "Wed",
    "thu": "Thu",
    "fri": "Fri",
    "sat": "Sat",
    "sun": "Sun",
}


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


def _pantry_coordinates(name: str | None) -> tuple[float, float] | None:
    if not name:
        return None
    return PANTRY_COORDINATES_BY_NAME.get(_normalize_location_text(name))


def _pantry_city(location: str | None) -> str | None:
    if not location:
        return None
    parts = [part.strip() for part in location.split(",")]
    if len(parts) >= 2 and parts[1]:
        return parts[1]
    return None


def _format_operating_hours(operating_hours: list[dict] | None, limit: int = 3) -> str:
    if not operating_hours:
        return "hours not listed"

    formatted = []
    for entry in operating_hours[:limit]:
        day = DAY_LABELS.get(str(entry.get("day", "")).lower(), str(entry.get("day", "")).title())
        open_time = entry.get("open")
        close_time = entry.get("close")
        if day and open_time and close_time:
            formatted.append(f"{day} {open_time}-{close_time}")

    if not formatted:
        return "hours not listed"

    if len(operating_hours) > limit:
        formatted.append("more hours listed")
    return "; ".join(formatted)


def _distance_miles(origin: tuple[float, float], destination: tuple[float, float]) -> float:
    """Return approximate great-circle distance in miles."""
    lat1, lon1 = origin
    lat2, lon2 = destination
    radius_miles = 3958.8

    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = (
        math.sin(delta_phi / 2) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2) ** 2
    )
    return radius_miles * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _coerce_user_location(user_location: dict | None) -> tuple[float, float] | None:
    if not user_location:
        return None
    try:
        latitude = float(user_location.get("latitude"))
        longitude = float(user_location.get("longitude"))
    except (TypeError, ValueError):
        return None
    if not (-90 <= latitude <= 90 and -180 <= longitude <= 180):
        return None
    return (latitude, longitude)


def _format_pantry_options(pantries: list[dict], limit: int = 5) -> str:
    lines = []
    for pantry in pantries[:limit]:
        status = "open" if pantry["isOpen"] else "closed"
        distance = pantry.get("distanceMiles")
        distance_text = f"{distance:.1f} miles away. " if isinstance(distance, float) else ""
        hours = _format_operating_hours(pantry.get("operatingHours"))
        maps_url = f"https://www.google.com/maps/search/?api=1&query={quote_plus(pantry['location'])}"
        lines.append(
            f"- {pantry['name']} — {distance_text}{pantry['location']}. "
            f"Currently marked {status}. Hours: {hours}. [Open in Maps]({maps_url})"
        )
    extra = len(pantries) - limit
    if extra > 0:
        lines.append(f"- Plus {extra} more matching pantry location(s).")
    return "\n".join(lines)


def _load_pantry_location_rows() -> list[dict]:
    session = None
    try:
        session = SessionLocal()
        pantries = session.query(Pantry).order_by(Pantry.id.asc()).all()
        return [
            {
                "id": pantry.id,
                "name": pantry.name,
                "location": pantry.location or "Location not listed",
                "isOpen": pantry.is_open,
                "city": _pantry_city(pantry.location),
                "operatingHours": pantry.operating_hours or [],
                "coordinates": _pantry_coordinates(pantry.name),
            }
            for pantry in pantries
        ]
    finally:
        if session is not None:
            session.close()


def _answer_nearest_pantry_question(message: str, user_location: dict | None = None) -> str | None:
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

    origin = _coerce_user_location(user_location)
    if origin:
        with_distance = []
        for pantry in pantries:
            coordinates = pantry.get("coordinates")
            if not coordinates:
                continue
            with_distance.append({
                **pantry,
                "distanceMiles": _distance_miles(origin, coordinates),
            })
        with_distance.sort(key=lambda pantry: pantry["distanceMiles"])
        if with_distance:
            nearest = with_distance[0]
            nearby_options = with_distance[1:4]
            nearby_text = (
                "\n\nOther nearby options:\n"
                f"{_format_pantry_options(nearby_options, limit=3)}"
                if nearby_options
                else ""
            )
            return (
                "Using your shared location, the nearest pantry I found is:\n"
                f"{_format_pantry_options([nearest], limit=1)}"
                f"{nearby_text}\n\n"
                "Distances are approximate."
            )

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
    session = None
    try:
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
    session = None
    try:
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
    user_location: dict | None = None,
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

    nearest_answer = _answer_nearest_pantry_question(user_message, user_location=user_location)
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
