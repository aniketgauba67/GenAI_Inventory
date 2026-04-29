from __future__ import annotations

from pydantic import BaseModel, Field
from fastapi import APIRouter

from back.services.gemini_chatbot import call_gemini_chat

router = APIRouter(prefix="/chat", tags=["chat"])


class ChatUserLocation(BaseModel):
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    accuracy: float | None = Field(default=None, ge=0)


class ChatMessageRequest(BaseModel):
    message: str = Field(min_length=1)
    history: list[tuple[str, str]] = Field(default_factory=list)
    pantry_id: int | None = None
    user_location: ChatUserLocation | None = None


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
        pantry_id=payload.pantry_id,
        user_location=payload.user_location.model_dump() if payload.user_location else None,
        include_db_context=True,
    )
    if not reply:
        return ChatMessageResponse(
            ok=False,
            error="Chatbot is unavailable right now. Please try again in a moment.",
        )

    return ChatMessageResponse(ok=True, reply=reply)
