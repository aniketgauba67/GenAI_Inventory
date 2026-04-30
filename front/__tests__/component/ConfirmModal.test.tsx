/******************************** ConfirmModal.test.tsx ***************************************
 *
 *  Module: Frontend Component Confirm Modal Test
 *
 *  This module defines automated frontend checks for frontend component confirm modal test.
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
import userEvent from "@testing-library/user-event";
import ConfirmModal from "@/components/ui/ConfirmModal";

const defaultProps = {
  open: true,
  title: "Delete item",
  description: "Are you sure you want to delete this item?",
  onConfirm: jest.fn(),
  onCancel: jest.fn(),
};

describe("ConfirmModal", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders nothing when open=false", () => {
    render(<ConfirmModal {...defaultProps} open={false} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders dialog when open=true", () => {
    render(<ConfirmModal {...defaultProps} />);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("displays title and description", () => {
    render(<ConfirmModal {...defaultProps} />);
    expect(screen.getByText("Delete item")).toBeInTheDocument();
    expect(
      screen.getByText("Are you sure you want to delete this item?"),
    ).toBeInTheDocument();
  });

  it("has aria-modal=true", () => {
    render(<ConfirmModal {...defaultProps} />);
    expect(screen.getByRole("dialog")).toHaveAttribute("aria-modal", "true");
  });

  it("has aria-labelledby pointing to title id", () => {
    render(<ConfirmModal {...defaultProps} />);
    const dialog = screen.getByRole("dialog");
    const labelledBy = dialog.getAttribute("aria-labelledby");
    expect(labelledBy).toBeTruthy();
    const titleEl = document.getElementById(labelledBy!);
    expect(titleEl?.textContent).toBe("Delete item");
  });

  it("calls onCancel when cancel button is clicked", () => {
    render(<ConfirmModal {...defaultProps} />);
    fireEvent.click(screen.getByText("Cancel"));
    expect(defaultProps.onCancel).toHaveBeenCalledTimes(1);
  });

  it("calls onConfirm when confirm button is clicked", () => {
    render(<ConfirmModal {...defaultProps} />);
    fireEvent.click(screen.getByText("Confirm"));
    expect(defaultProps.onConfirm).toHaveBeenCalledTimes(1);
  });

  it("uses custom button labels", () => {
    render(
      <ConfirmModal
        {...defaultProps}
        confirmLabel="Yes, delete"
        cancelLabel="No, keep"
      />,
    );
    expect(screen.getByText("Yes, delete")).toBeInTheDocument();
    expect(screen.getByText("No, keep")).toBeInTheDocument();
  });

  it("shows 'Working...' on confirm button when loading=true", () => {
    render(<ConfirmModal {...defaultProps} loading />);
    expect(screen.getByText("Working...")).toBeInTheDocument();
  });

  it("disables both buttons when loading=true", () => {
    render(<ConfirmModal {...defaultProps} loading />);
    const buttons = screen.getAllByRole("button");
    buttons.forEach((btn) => expect(btn).toBeDisabled());
  });

  it("applies rose color to confirm button when danger=true", () => {
    render(<ConfirmModal {...defaultProps} danger />);
    const confirmBtn = screen.getByText("Confirm");
    expect(confirmBtn.className).toContain("rose");
  });

  it("applies sky color to confirm button when danger=false (default)", () => {
    render(<ConfirmModal {...defaultProps} />);
    const confirmBtn = screen.getByText("Confirm");
    expect(confirmBtn.className).toContain("sky");
  });

  it("calls onCancel when Escape key is pressed", async () => {
    const user = userEvent.setup();
    render(<ConfirmModal {...defaultProps} />);
    await user.keyboard("{Escape}");
    expect(defaultProps.onCancel).toHaveBeenCalled();
  });

  it("focuses cancel button when opened", () => {
    render(<ConfirmModal {...defaultProps} />);
    const cancelBtn = screen.getByText("Cancel");
    expect(document.activeElement).toBe(cancelBtn);
  });
});
