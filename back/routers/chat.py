from __future__ import annotations

from pydantic import BaseModel, Field
from fastapi import APIRouter

try:
    from ..services.gemini_chatbot import call_gemini_chat
except ImportError:
    from services.gemini_chatbot import call_gemini_chat

router = APIRouter(prefix="/chat", tags=["chat"])


class ChatMessageRequest(BaseModel):
    message: str = Field(min_length=1)
    history: list[tuple[str, str]] = Field(default_factory=list)
    pantry_id: int | None = None


class ChatMessageResponse(BaseModel):
    ok: bool
    reply: str | None = None
    error: str | None = None


@router.post("/message", response_model=ChatMessageResponse)
def send_chat_message(payload: ChatMessageRequest) -> ChatMessageResponse:
    """Return one Gemini chatbot response for a user message."""
    reply = call_gemini_chat(
        user_message=payload.message,
        history=payload.history,
        pantry_id=None,
        include_db_context=True,
    )
    if not reply:
        return ChatMessageResponse(
            ok=False,
            error="Chatbot is unavailable right now. Please try again in a moment.",
        )

    return ChatMessageResponse(ok=True, reply=reply)
