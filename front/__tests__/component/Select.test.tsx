import { render, screen, fireEvent } from "@testing-library/react";
import Select from "@/components/ui/Select";

describe("Select", () => {
  const options = ["Option A", "Option B", "Option C"];

  const renderSelect = (props = {}) =>
    render(
      <Select {...props}>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </Select>,
    );

  it("renders a select element", () => {
    renderSelect();
    expect(screen.getByRole("combobox")).toBeInTheDocument();
  });

  it("renders all options", () => {
    renderSelect();
    options.forEach((o) => {
      expect(screen.getByRole("option", { name: o })).toBeInTheDocument();
    });
  });

  it("shows selected value", () => {
    renderSelect({ value: "Option B", onChange: jest.fn() });
    expect(screen.getByRole("combobox")).toHaveValue("Option B");
  });

  it("calls onChange when option selected", () => {
    const onChange = jest.fn();
    renderSelect({ onChange });
    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "Option C" },
    });
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("is disabled when disabled prop is set", () => {
    renderSelect({ disabled: true });
    expect(screen.getByRole("combobox")).toBeDisabled();
  });

  it("applies custom className", () => {
    renderSelect({ className: "custom-select" });
    expect(screen.getByRole("combobox").className).toContain("custom-select");
  });

  it("has base styling classes", () => {
    renderSelect();
    const el = screen.getByRole("combobox");
    expect(el.className).toContain("rounded-xl");
    expect(el.className).toContain("border");
  });

  it("renders with required attribute", () => {
    renderSelect({ required: true });
    expect(screen.getByRole("combobox")).toBeRequired();
  });

  it("renders children (options) correctly", () => {
    renderSelect();
    const combobox = screen.getByRole("combobox");
    expect(combobox.children.length).toBe(3);
  });
});
