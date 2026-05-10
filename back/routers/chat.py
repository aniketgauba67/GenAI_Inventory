"""******************************* chat.py ***************************************
 *
 *  Module: Chat Router
 *
 *  This module passes chatbot messages and optional user location to the
 *  Gemini chatbot service.
 *
 *  The module provides:
 *
 *  - chat request and response schemas.
 *  - browser geolocation payload validation.
 *  - a single message endpoint for the floating chat UI.
 *
 *  Key Structures Used:
 *
 *  - Pydantic models, FastAPI route handlers, and Gemini chatbot context.
 *
 *  This module ensures:
 *
 *  - invalid coordinates are rejected before service calls.
 *  - chat responses return a consistent success or error shape.
 *
 *  Editors: Aniket, Dipanker, Liam, Jin, and Philip.
 *
 ****************************************************************************
"""

from __future__ import annotations

from pydantic import BaseModel, Field
from fastapi import APIRouter

from back.services.gemini_chatbot import call_gemini_chat

router = APIRouter(prefix="/chat", tags=["chat"])


class ChatUserLocation(BaseModel):
    """Browser geolocation coordinates supplied with a chatbot request.

    Fields:
        latitude: Decimal latitude from the browser geolocation API.
        longitude: Decimal longitude from the browser geolocation API.
        accuracy: Optional browser-reported accuracy radius in meters.
    """

    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    accuracy: float | None = Field(default=None, ge=0)


class ChatMessageRequest(BaseModel):
    """Payload sent by the frontend chat widget.

    Fields:
        message: The latest user message.
        history: Prior chat turns kept by the frontend.
        pantry_id: Optional pantry context selected in the UI.
        user_location: Optional coordinates used for nearest-pantry questions.
    """

    message: str = Field(min_length=1)
    history: list[tuple[str, str]] = Field(default_factory=list)
    pantry_id: int | None = None
    user_location: ChatUserLocation | None = None


class ChatMessageResponse(BaseModel):
    """Response returned to the frontend chat widget.

    Fields:
        ok: Whether the chatbot request succeeded.
        reply: Assistant text when the request succeeds.
        error: User-facing error text when the request fails.
    """

    ok: bool
    reply: str | None = None
    error: str | None = None


@router.post("/message", response_model=ChatMessageResponse)
def send_chat_message(payload: ChatMessageRequest) -> ChatMessageResponse:
    """Return one Gemini chatbot response for a user message.

    Parameters:
        payload: Chat message, prior history, optional pantry ID, and optional
        browser location.

    Returns:
        A chat response containing either Gemini's reply or an availability
        error for the frontend.
    """
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
