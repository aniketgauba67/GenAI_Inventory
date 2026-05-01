/******************************** FloatingChat.tsx ***************************************
 *
 *  Module: Floating Chat Component
 *
 *  This module renders the customer pantry chatbot and location-aware
 *  question flow.
 *
 *  The module provides:
 *
 *  - expandable chat panel UI.
 *  - chat history submission to the API route.
 *  - browser location capture for nearest-pantry questions.
 *
 *  Key Structures Used:
 *
 *  - React state, chat message history, geolocation permission responses.
 *
 *  This module ensures:
 *
 *  - chat interactions remain available across customer pages.
 *  - location is only used when the browser grants permission.
 *
 *  Editors: Aniket, Dipankar, Liam, Jin, and Philip.
 *
 *****************************************************************************/
"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type ChatRole = "user" | "assistant";

type ChatMessage = {
  id: string;
  role: ChatRole;
  text: string;
};

type FloatingChatProps = {
  pantryId?: string;
};

type ChatUserLocation = {
  latitude: number;
  longitude: number;
  accuracy?: number | null;
};

function createMessage(role: ChatRole, text: string): ChatMessage {
  return {
    id: `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    role,
    text,
  };
}

const INITIAL_ASSISTANT_MESSAGE = createMessage(
  "assistant",
  "Hi there! Ask me any questions about pantry inventory, stock levels, or recent updates.",
);

function isNearestPantryQuestion(message: string): boolean {
  const normalized = message.toLowerCase();
  const mentionsPantryLikePlace = (
    /\b(pantr(?:y|ies|ys)|patr(?:y|ies)|food\s+(?:pantry|bank)|fpn|location|site)\b/.test(normalized)
  );
  const asksForNearbyPlace = (
    /\b(nearest|closest|nearby|directions?|maps?|near)\b/.test(normalized) ||
    normalized.includes("near me") ||
    normalized.includes("around me") ||
    normalized.includes("my location")
  );

  return asksForNearbyPlace && (mentionsPantryLikePlace || normalized.includes("near me"));
}

function getCurrentLocation(): Promise<ChatUserLocation | null> {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        });
      },
      () => resolve(null),
      {
        enableHighAccuracy: false,
        maximumAge: 5 * 60 * 1000,
        timeout: 8000,
      },
    );
  });
}

function getTypingDelay(currentChar: string): number {
  if (currentChar === "," || currentChar === ";") {
    return 130;
  }
  if (currentChar === "." || currentChar === "!" || currentChar === "?") {
    return 210;
  }
  if (currentChar === "\n") {
    return 160;
  }
  return 18;
}

type TypingMarkdownProps = {
  text: string;
  shouldType: boolean;
  onTypingDone?: () => void;
  onTypingProgress?: () => void;
};

function TypingMarkdown({
  text,
  shouldType,
  onTypingDone,
  onTypingProgress,
}: TypingMarkdownProps) {
  const [animatedText, setAnimatedText] = useState("");
  const onTypingDoneRef = useRef(onTypingDone);
  const onTypingProgressRef = useRef(onTypingProgress);

  // Derive displayedText: when not in typing mode, show full text directly (no state needed)
  const displayedText = shouldType ? animatedText : text;

  useEffect(() => {
    onTypingDoneRef.current = onTypingDone;
  }, [onTypingDone]);

  useEffect(() => {
    onTypingProgressRef.current = onTypingProgress;
  }, [onTypingProgress]);

  useEffect(() => {
    if (!shouldType) return;

    let cancelled = false;
    let index = 0;

    // Reset async so it doesn't trigger synchronous cascade in the effect body
    window.setTimeout(() => {
      if (!cancelled) setAnimatedText("");
    }, 0);

    const tick = () => {
      if (cancelled) return;

      index += 1;
      setAnimatedText(text.slice(0, index));
      onTypingProgressRef.current?.();

      if (index >= text.length) {
        onTypingDoneRef.current?.();
        return;
      }

      const currentChar = text[index - 1] || "";
      window.setTimeout(tick, getTypingDelay(currentChar));
    };

    window.setTimeout(tick, 120);

    return () => {
      cancelled = true;
    };
  }, [text, shouldType]);

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        a: ({ ...props }) => (
          <a
            {...props}
            target="_blank"
            rel="noreferrer noopener"
            className="underline"
          />
        ),
        p: ({ ...props }) => <p {...props} className="mb-1 last:mb-0" />,
        ul: ({ ...props }) => <ul {...props} className="mb-1 list-disc pl-5" />,
        ol: ({ ...props }) => <ol {...props} className="mb-1 list-decimal pl-5" />,
        code: ({ className, children, ...props }) => {
          const isBlock = Boolean(className?.includes("language-"));
          if (isBlock) {
            return (
              <code
                {...props}
                className={`${className || ""} block overflow-x-auto rounded-lg bg-black/15 px-2 py-1 text-xs dark:bg-white/10`}
              >
                {children}
              </code>
            );
          }
          return (
            <code
              {...props}
              className="rounded bg-black/10 px-1 py-0.5 text-xs dark:bg-white/15"
            >
              {children}
            </code>
          );
        },
      }}
    >
      {displayedText}
    </ReactMarkdown>
  );
}

export default function FloatingChat({ pantryId = "" }: FloatingChatProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([INITIAL_ASSISTANT_MESSAGE]);
  const [typedAssistantMessageIds, setTypedAssistantMessageIds] = useState<Set<string>>(
    () => new Set([INITIAL_ASSISTANT_MESSAGE.id]),
  );
  const scrollAreaRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  function resizeInput() {
    const el = inputRef.current;
    if (!el) return;
    const baseHeight = 36;
    el.style.height = `${baseHeight}px`;
    if (!el.value.trim()) {
      el.style.overflowY = "hidden";
      return;
    }
    const nextHeight = Math.min(Math.max(el.scrollHeight, baseHeight), 144);
    el.style.height = `${nextHeight}px`;
    el.style.overflowY = el.scrollHeight > 144 ? "auto" : "hidden";
  }

  const history = useMemo(() => {
    return messages.map((m) => [m.role, m.text] as ["user" | "assistant", string]);
  }, [messages]);

  useEffect(() => {
    resizeInput();
  }, [input, isOpen]);

  async function handleSend() {
    const trimmed = input.trim();
    if (!trimmed || isSending) return;

    const userMessage = createMessage("user", trimmed);
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setInput("");
    setIsSending(true);

    try {
      const userLocation = isNearestPantryQuestion(trimmed) ? await getCurrentLocation() : null;
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmed,
          history,
          pantryId: pantryId || null,
          userLocation,
        }),
      });

      const data = (await response.json()) as {
        ok?: boolean;
        reply?: string;
        error?: string;
      };

      if (!response.ok || !data.ok || !data.reply) {
        setMessages((prev) => [
          ...prev,
          createMessage("assistant", data.error || "I could not get a response from the API right now."),
        ]);
        return;
      }

      setMessages((prev) => [...prev, createMessage("assistant", data.reply as string)]);
    } catch {
      setMessages((prev) => [
        ...prev,
        createMessage("assistant", "Network error while contacting the chatbot API."),
      ]);
    } finally {
      setIsSending(false);
      requestAnimationFrame(() => {
        scrollAreaRef.current?.scrollTo({ top: scrollAreaRef.current.scrollHeight, behavior: "smooth" });
      });
    }
  }

  return (
    <div className="pointer-events-none fixed bottom-5 right-5 z-50 sm:bottom-6 sm:right-6">
      <div
        className={`pointer-events-auto origin-bottom-right overflow-hidden rounded-[1.8rem] border border-teal-200/80 bg-white/95 shadow-2xl shadow-teal-900/25 backdrop-blur-md transition-all duration-300 dark:border-slate-800/80 dark:bg-slate-950/96 dark:shadow-[0_24px_60px_rgba(2,6,23,0.65)] ${
          isOpen
            ? "h-[min(72vh,34rem)] w-[min(calc(100vw-1.5rem),23rem)] scale-100"
            : "h-16 w-16 scale-100"
        }`}
      >
        {!isOpen ? (
          <button
            type="button"
            onClick={() => setIsOpen(true)}
            className="flex h-full w-full items-center justify-center rounded-full bg-gradient-to-br from-teal-500 to-orange-500 p-2 transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 dark:from-teal-400 dark:to-cyan-500"
            aria-label="Open chat"
          >
            <Image
              src="/chatbot-placeholder.svg"
              alt="Open chatbot"
              width={38}
              height={38}
              className="rounded-full bg-white/85 p-1"
            />
          </button>
        ) : (
          <div className="flex h-full flex-col">
            <div className="flex items-center justify-between border-b border-slate-200/80 px-4 py-3 dark:border-slate-800/90 dark:bg-slate-950/70">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-700 dark:text-teal-200">
                  Inventory Assistant
                </p>
                <p className="text-sm text-slate-600 dark:text-slate-400">Ask anything about current stock.</p>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-full border border-slate-300 px-2 py-0.5 text-sm text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                aria-label="Close chat"
              >
                x
              </button>
            </div>

            <div ref={scrollAreaRef} className="flex-1 space-y-2 overflow-y-auto px-3 py-3">
              {messages.map((message) => {
                const isUser = message.role === "user";
                const shouldTypeAssistantMessage = !isUser && !typedAssistantMessageIds.has(message.id);
                return (
                  <div key={message.id} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[84%] rounded-2xl px-3 py-2 text-sm leading-5 ${
                        isUser
                          ? "rounded-br-md bg-teal-600 text-white dark:bg-teal-500"
                          : "rounded-bl-md bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-100"
                      }`}
                    >
                      <p
                        className={`mb-1 text-[11px] font-bold uppercase tracking-[0.12em] ${
                          isUser ? "text-teal-100" : "text-slate-500 dark:text-slate-400"
                        }`}
                      >
                        {isUser ? "You" : "FPN-Bot"}
                      </p>
                      <TypingMarkdown
                        text={message.text}
                        shouldType={shouldTypeAssistantMessage}
                        onTypingProgress={() => {
                          requestAnimationFrame(() => {
                            scrollAreaRef.current?.scrollTo({
                              top: scrollAreaRef.current.scrollHeight,
                              behavior: "smooth",
                            });
                          });
                        }}
                        onTypingDone={() => {
                          if (!isUser) {
                            setTypedAssistantMessageIds((prev) => {
                              const next = new Set(prev);
                              next.add(message.id);
                              return next;
                            });
                          }
                        }}
                      />
                    </div>
                  </div>
                );
              })}
              {isSending && (
                <div className="flex justify-start">
                  <div className="rounded-2xl rounded-bl-md bg-slate-100 px-3 py-2 text-sm text-slate-600 dark:bg-slate-900 dark:text-slate-300">
                    Thinking...
                  </div>
                </div>
              )}
            </div>

            <form
              className="border-t border-slate-200/80 p-3 dark:border-slate-800/90 dark:bg-slate-950/70"
              onSubmit={(event) => {
                event.preventDefault();
                void handleSend();
              }}
            >
              <div className="flex items-center gap-2">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      void handleSend();
                    }
                  }}
                  placeholder="Type your question..."
                  rows={1}
                  className="h-9 max-h-36 w-full resize-none rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-teal-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
                <button
                  type="submit"
                  disabled={isSending || !input.trim()}
                  className="rounded-xl bg-teal-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-teal-500 dark:hover:bg-teal-400"
                >
                  Send
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
