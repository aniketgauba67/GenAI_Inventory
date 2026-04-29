/**
 * Component tests for FloatingChat.
 *
 * Uses jest.fn() to mock fetch instead of MSW, avoiding ESM compatibility
 * issues with msw/rettime in jsdom.
 */

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import FloatingChat from "@/components/chat/FloatingChat";

// Mock Next.js Image (not available in jest-dom)
jest.mock("next/image", () => ({
  __esModule: true,
  default: (props: React.ImgHTMLAttributes<HTMLImageElement>) => {
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    return <img {...props} />;
  },
}));

// Mock react-markdown and remark-gfm (ESM-only packages; not transformable by jest)
jest.mock("react-markdown", () => ({
  __esModule: true,
  default: ({ children }: { children: string }) => <span>{children}</span>,
}));
jest.mock("remark-gfm", () => ({
  __esModule: true,
  default: () => undefined,
}));

// Typed fetch mock — use plain objects instead of new Response() since
// jsdom does not expose the Fetch API Response constructor.
const mockFetch = jest.fn();

function makeFetchResult(data: object, ok = true) {
  return Promise.resolve({ ok, json: async () => data });
}

// jsdom doesn't implement scrollTo on DOM elements — stub it out
beforeAll(() => {
  window.HTMLElement.prototype.scrollTo = jest.fn();
});

beforeEach(() => {
  mockFetch.mockReset();
  // Default: successful reply
  mockFetch.mockReturnValue(makeFetchResult({ ok: true, reply: "Mock bot reply" }));
  global.fetch = mockFetch as typeof fetch;
  Object.defineProperty(navigator, "geolocation", {
    configurable: true,
    value: undefined,
  });
});

describe("FloatingChat", () => {
  it("renders a collapsed button by default", () => {
    render(<FloatingChat />);
    expect(screen.getByRole("button", { name: "Open chat" })).toBeInTheDocument();
  });

  it("opens the chat panel when the button is clicked", async () => {
    const user = userEvent.setup();
    render(<FloatingChat />);
    await user.click(screen.getByRole("button", { name: "Open chat" }));
    expect(screen.getByText("Inventory Assistant")).toBeInTheDocument();
  });

  it("shows the initial greeting message after opening", async () => {
    const user = userEvent.setup();
    render(<FloatingChat />);
    await user.click(screen.getByRole("button", { name: "Open chat" }));
    await waitFor(() => {
      expect(
        screen.getByText(/Ask me any questions about pantry inventory/i),
      ).toBeInTheDocument();
    });
  });

  it("closes the chat when the × button is clicked", async () => {
    const user = userEvent.setup();
    render(<FloatingChat />);
    await user.click(screen.getByRole("button", { name: "Open chat" }));
    await user.click(screen.getByRole("button", { name: "Close chat" }));
    expect(screen.queryByText("Inventory Assistant")).not.toBeInTheDocument();
  });

  it("renders the input textarea after opening", async () => {
    const user = userEvent.setup();
    render(<FloatingChat />);
    await user.click(screen.getByRole("button", { name: "Open chat" }));
    expect(screen.getByPlaceholderText(/Type your question/i)).toBeInTheDocument();
  });

  it("Send button is disabled when input is empty", async () => {
    const user = userEvent.setup();
    render(<FloatingChat />);
    await user.click(screen.getByRole("button", { name: "Open chat" }));
    expect(screen.getByRole("button", { name: /send/i })).toBeDisabled();
  });

  it("Send button is enabled when text is typed", async () => {
    const user = userEvent.setup();
    render(<FloatingChat />);
    await user.click(screen.getByRole("button", { name: "Open chat" }));
    await user.type(screen.getByPlaceholderText(/Type your question/i), "Hello");
    expect(screen.getByRole("button", { name: /send/i })).toBeEnabled();
  });

  it("sends message on form submit and shows user bubble", async () => {
    const user = userEvent.setup();
    render(<FloatingChat />);
    await user.click(screen.getByRole("button", { name: "Open chat" }));
    const input = screen.getByPlaceholderText(/Type your question/i);
    await user.type(input, "What's in stock?");
    await user.click(screen.getByRole("button", { name: /send/i }));
    expect(screen.getByText("What's in stock?")).toBeInTheDocument();
  });

  it("shows Thinking... indicator while awaiting response", async () => {
    // Make fetch hang so we can observe the loading state
    let resolveFetch!: (v: object) => void;
    mockFetch.mockReturnValueOnce(
      new Promise<object>((r) => { resolveFetch = r; }),
    );

    const user = userEvent.setup();
    render(<FloatingChat />);
    await user.click(screen.getByRole("button", { name: "Open chat" }));
    await user.type(screen.getByPlaceholderText(/Type your question/i), "Hi");
    await user.click(screen.getByRole("button", { name: /send/i }));

    await waitFor(() => {
      expect(screen.getByText("Thinking...")).toBeInTheDocument();
    });

    // Resolve to avoid pending promise warnings
    resolveFetch({ ok: true, json: async () => ({ ok: true, reply: "Done" }) });
  });

  it("shows error message when API fails", async () => {
    mockFetch.mockReturnValueOnce(makeFetchResult({ ok: false, error: "API unavailable" }, false));

    const user = userEvent.setup();
    render(<FloatingChat />);
    await user.click(screen.getByRole("button", { name: "Open chat" }));
    await user.type(screen.getByPlaceholderText(/Type your question/i), "Hello");
    await user.click(screen.getByRole("button", { name: /send/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/API unavailable|could not get a response|error/i),
      ).toBeInTheDocument();
    });
  });

  it("clears input after message is sent", async () => {
    const user = userEvent.setup();
    render(<FloatingChat />);
    await user.click(screen.getByRole("button", { name: "Open chat" }));
    const input = screen.getByPlaceholderText(/Type your question/i);
    await user.type(input, "Test message");
    await user.click(screen.getByRole("button", { name: /send/i }));
    await waitFor(() => {
      expect(input).toHaveValue("");
    });
  });

  it("sends message on Enter key press", async () => {
    const user = userEvent.setup();
    render(<FloatingChat />);
    await user.click(screen.getByRole("button", { name: "Open chat" }));
    const input = screen.getByPlaceholderText(/Type your question/i);
    await user.type(input, "Hello{Enter}");
    expect(screen.getByText("Hello")).toBeInTheDocument();
  });

  it("does not send on Shift+Enter (new line)", async () => {
    const user = userEvent.setup();
    render(<FloatingChat />);
    await user.click(screen.getByRole("button", { name: "Open chat" }));
    const input = screen.getByPlaceholderText(/Type your question/i);
    await user.type(input, "Line1{Shift>}{Enter}{/Shift}");
    // Should not have sent — Thinking... or user bubble should not appear
    expect(screen.queryByText("Thinking...")).not.toBeInTheDocument();
  });

  it("forwards pantryId prop to API call", async () => {
    let capturedBody: Record<string, unknown> = {};
    mockFetch.mockImplementationOnce(async (_url: unknown, options: RequestInit) => {
      capturedBody = JSON.parse((options?.body as string) ?? "{}");
      return { ok: true, json: async () => ({ ok: true, reply: "ok" }) };
    });

    const user = userEvent.setup();
    render(<FloatingChat pantryId="5" />);
    await user.click(screen.getByRole("button", { name: "Open chat" }));
    await user.type(screen.getByPlaceholderText(/Type your question/i), "Hi");
    await user.click(screen.getByRole("button", { name: /send/i }));
    await waitFor(() => expect(capturedBody.pantryId).toBe("5"));
  });

  it("requests browser location for typo nearest-pantry wording", async () => {
    const getCurrentPosition = jest.fn((success: PositionCallback) => {
      success({
        coords: {
          latitude: 40.02,
          longitude: -82.445,
          accuracy: 25,
          altitude: null,
          altitudeAccuracy: null,
          heading: null,
          speed: null,
        },
        timestamp: Date.now(),
      } as GeolocationPosition);
    });
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: { getCurrentPosition },
    });

    let capturedBody: Record<string, unknown> = {};
    mockFetch.mockImplementationOnce(async (_url: unknown, options: RequestInit) => {
      capturedBody = JSON.parse((options?.body as string) ?? "{}");
      return { ok: true, json: async () => ({ ok: true, reply: "ok" }) };
    });

    const user = userEvent.setup();
    render(<FloatingChat />);
    await user.click(screen.getByRole("button", { name: "Open chat" }));
    await user.type(screen.getByPlaceholderText(/Type your question/i), "find nearest patry near me");
    await user.click(screen.getByRole("button", { name: /send/i }));

    await waitFor(() => {
      expect(getCurrentPosition).toHaveBeenCalled();
      expect(capturedBody.userLocation).toEqual({
        latitude: 40.02,
        longitude: -82.445,
        accuracy: 25,
      });
    });
  });
});
