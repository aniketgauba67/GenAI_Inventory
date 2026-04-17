import logging
from pathlib import Path
import sys
import json

from config import GEMINI_MODEL, get_gemini_api_key

log = logging.getLogger(__name__)

DEFAULT_CHATBOT_SYSTEM_PROMPT = (
    "You are a helpful assistant to answer user questions regarding pantry and inventory operations. "
    "Be concise, practical, and ask clarifying questions when details are missing."
)


def _fetch_db_chat_context(pantry_id: int | None = None, recent_runs: int = 5) -> str | None:
    """Fetch a compact, read-only DB snapshot for retrieval-augmented chat answers."""
    root_dir = Path(__file__).resolve().parents[2]
    db_dir = root_dir / "db"
    if str(db_dir) not in sys.path:
        sys.path.insert(0, str(db_dir))

    session = None
    try:
        from database import SessionLocal  # pyright: ignore[reportMissingImports]
        from models import InventoryRun, Pantry  # pyright: ignore[reportMissingImports]

        session = SessionLocal()

        pantry_query = session.query(Pantry).order_by(Pantry.id.asc())
        if pantry_id is not None:
            pantry_query = pantry_query.filter(Pantry.id == pantry_id)

        pantries = pantry_query.all()

        runs_query = session.query(InventoryRun).order_by(InventoryRun.created_at.desc())
        if pantry_id is not None:
            runs_query = runs_query.filter(InventoryRun.pantry_id == pantry_id)

        runs = runs_query.limit(recent_runs).all()

        context_payload = {
            "pantries": [
                {
                    "id": pantry.id,
                    "name": pantry.name,
                    "location": pantry.location,
                    "isOpen": pantry.is_open,
                    # [{"day":"mon","open":"11:00","close":"16:00"}, ...]
                    "operatingHours": pantry.operating_hours or [],
                }
                for pantry in pantries
            ],
            "recentInventoryRuns": [
                {
                    "runId": run.run_id,
                    "pantryId": run.pantry_id,
                    "createdAt": run.created_at.isoformat(),
                    "source": run.source,
                    "inventory": run.inventory,
                    "comparison": run.comparison,
                }
                for run in runs
            ],
        }
        return json.dumps(context_payload)
    except Exception as e:
        log.warning("Could not load DB context for chatbot: %s", e)
        return None
    finally:
        if session is not None:
            session.close()


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

    model = _build_chat_model()
    if model is None:
        return None

    try:
        from langchain_core.messages import AIMessage, HumanMessage, SystemMessage

        messages = [SystemMessage(content=system_prompt)]
        if include_db_context:
            db_context = _fetch_db_chat_context(pantry_id=pantry_id)
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
