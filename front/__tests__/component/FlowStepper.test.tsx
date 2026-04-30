/******************************** FlowStepper.test.tsx ***************************************
 *
 *  Module: Frontend Component Flow Stepper Test
 *
 *  This module defines automated frontend checks for frontend component flow stepper test.
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
import FlowStepper from "@/components/workflow/FlowStepper";

const steps = ["Upload", "Review", "Save Baseline"];

describe("FlowStepper", () => {
  it("renders all step labels", () => {
    render(<FlowStepper steps={steps} currentStep={0} />);
    steps.forEach((label) => {
      expect(screen.getByText(label)).toBeInTheDocument();
    });
  });

  it("renders step numbers when no status is set", () => {
    render(<FlowStepper steps={steps} currentStep={0} />);
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("highlights the current step label as bold", () => {
    render(<FlowStepper steps={steps} currentStep={1} />);
    const reviewLabel = screen.getByText("Review");
    expect(reviewLabel.className).toContain("font-semibold");
  });

  it("current step badge has ring class", () => {
    render(<FlowStepper steps={steps} currentStep={0} />);
    // Step 1 is current — its badge should have ring-2
    const ordered = screen.getAllByRole("listitem");
    expect(ordered[0].innerHTML).toContain("ring-2");
  });

  it("shows spinner SVG when status='uploading' on current step", () => {
    const { container } = render(
      <FlowStepper steps={steps} currentStep={0} status="uploading" />,
    );
    const svgs = container.querySelectorAll("svg.animate-spin");
    expect(svgs.length).toBeGreaterThan(0);
  });

  it("does NOT show spinner on non-current steps", () => {
    const { container } = render(
      <FlowStepper steps={steps} currentStep={1} status="uploading" />,
    );
    const svgs = container.querySelectorAll("svg.animate-spin");
    // Spinner only on step 2 (index 1), steps 1 and 3 still show numbers
    expect(svgs.length).toBe(1);
  });

  it("shows step number when no status prop", () => {
    render(<FlowStepper steps={steps} currentStep={0} />);
    expect(screen.getByText("1")).toBeInTheDocument();
  });

  it("renders as an ordered list", () => {
    render(<FlowStepper steps={steps} currentStep={0} />);
    expect(screen.getByRole("list")).toBeInTheDocument();
  });

  it("renders separator lines between steps (hidden on mobile)", () => {
    const { container } = render(
      <FlowStepper steps={steps} currentStep={0} />,
    );
    // Separator spans have aria-hidden="true"
    const separators = container.querySelectorAll('[aria-hidden="true"]');
    // 2 separators for 3 steps (between 1-2 and 2-3), plus inner dot spans
    expect(separators.length).toBeGreaterThan(0);
  });

  it("single-step stepper renders without crash", () => {
    render(<FlowStepper steps={["Only Step"]} currentStep={0} />);
    expect(screen.getByText("Only Step")).toBeInTheDocument();
  });
});
