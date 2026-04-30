/******************************** Alert.test.tsx ***************************************
 *
 *  Module: Frontend Component Alert Test
 *
 *  This module defines automated frontend checks for frontend component alert test.
 *
 *  The module provides:
 *
 *  - Jest tests for UI components, API helpers, mocks, or integration paths.
 *  - assertions for rendering, accessibility, interactions, and error states.
 *  - regression coverage for customer, volunteer, and manager workflows.
 *
 *  Key Structures Used:
 *
 *  - Jest, React Testing Library, mock service workers, and shared fixtures.
 *
 *  This module ensures:
 *
 *  - frontend behavior stays predictable across refactors.
 *  - user-facing states remain covered by repeatable automated tests.
 *
 *  Editors: Aniket, Dipankar, Liam, Jin, and Philip.
 *
 *****************************************************************************/
import { render, screen } from "@testing-library/react";
import Alert from "@/components/ui/Alert";

describe("Alert", () => {
  it("renders children", () => {
    render(<Alert>Something went wrong.</Alert>);
    expect(screen.getByText("Something went wrong.")).toBeInTheDocument();
  });

  it("renders title when provided", () => {
    render(<Alert title="Error title">Body text</Alert>);
    expect(screen.getByText("Error title")).toBeInTheDocument();
    expect(screen.getByText("Body text")).toBeInTheDocument();
  });

  it("has role=alert for error tone", () => {
    render(<Alert tone="error">Error!</Alert>);
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("has role=status for info tone (default)", () => {
    render(<Alert>Info message</Alert>);
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("has role=status for success tone", () => {
    render(<Alert tone="success">Saved!</Alert>);
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("has role=status for warning tone", () => {
    render(<Alert tone="warning">Warning!</Alert>);
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("error tone has assertive aria-live", () => {
    render(<Alert tone="error">Error</Alert>);
    const el = screen.getByRole("alert");
    expect(el).toHaveAttribute("aria-live", "assertive");
  });

  it("info tone has polite aria-live", () => {
    render(<Alert tone="info">Info</Alert>);
    const el = screen.getByRole("status");
    expect(el).toHaveAttribute("aria-live", "polite");
  });

  it("applies error background color classes", () => {
    render(<Alert tone="error">Err</Alert>);
    expect(screen.getByRole("alert").className).toContain("rose");
  });

  it("applies success background color classes", () => {
    render(<Alert tone="success">Ok</Alert>);
    expect(screen.getByRole("status").className).toContain("emerald");
  });

  it("applies custom className", () => {
    render(<Alert className="mt-4">Message</Alert>);
    const el = screen.getByRole("status");
    expect(el.className).toContain("mt-4");
  });
});
