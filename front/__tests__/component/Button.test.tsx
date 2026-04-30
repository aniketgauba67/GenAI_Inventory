/******************************** Button.test.tsx ***************************************
 *
 *  Module: Frontend Component Button Test
 *
 *  This module defines automated frontend checks for frontend component button test.
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
import { render, screen, fireEvent } from "@testing-library/react";
import Button from "@/components/ui/Button";

describe("Button", () => {
  it("renders children", () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole("button", { name: "Click me" })).toBeInTheDocument();
  });

  it("defaults to primary variant", () => {
    render(<Button>Primary</Button>);
    const btn = screen.getByRole("button");
    expect(btn.className).toContain("sky");
  });

  it("applies ghost variant classes", () => {
    render(<Button variant="ghost">Ghost</Button>);
    expect(screen.getByRole("button").className).toContain("border");
  });

  it("applies destructive variant classes", () => {
    render(<Button variant="destructive">Delete</Button>);
    expect(screen.getByRole("button").className).toContain("rose");
  });

  it("applies secondary variant classes", () => {
    render(<Button variant="secondary">Secondary</Button>);
    expect(screen.getByRole("button").className).toContain("slate");
  });

  it("renders full width when block=true", () => {
    render(<Button block>Full width</Button>);
    expect(screen.getByRole("button").className).toContain("w-full");
  });

  it("does not render full width by default", () => {
    render(<Button>Normal</Button>);
    expect(screen.getByRole("button").className).not.toContain("w-full");
  });

  it("fires onClick when clicked", () => {
    const handler = jest.fn();
    render(<Button onClick={handler}>Click</Button>);
    fireEvent.click(screen.getByRole("button"));
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("is disabled when disabled prop is set", () => {
    render(<Button disabled>Disabled</Button>);
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("does not fire onClick when disabled", () => {
    const handler = jest.fn();
    render(<Button disabled onClick={handler}>Disabled</Button>);
    fireEvent.click(screen.getByRole("button"));
    expect(handler).not.toHaveBeenCalled();
  });

  it("passes type attribute through", () => {
    render(<Button type="submit">Submit</Button>);
    expect(screen.getByRole("button")).toHaveAttribute("type", "submit");
  });

  it("applies sm size classes", () => {
    render(<Button size="sm">Small</Button>);
    expect(screen.getByRole("button").className).toContain("text-xs");
  });

  it("applies lg size classes", () => {
    render(<Button size="lg">Large</Button>);
    expect(screen.getByRole("button").className).toContain("text-sm");
    expect(screen.getByRole("button").className).toContain("py-3");
  });

  it("applies custom className", () => {
    render(<Button className="custom-class">Custom</Button>);
    expect(screen.getByRole("button").className).toContain("custom-class");
  });
});
