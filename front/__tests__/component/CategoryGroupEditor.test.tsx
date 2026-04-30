/******************************** CategoryGroupEditor.test.tsx ***************************************
 *
 *  Module: Frontend Component Category Group Editor Test
 *
 *  This module defines automated frontend checks for frontend component category group editor test.
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
import CategoryGroupEditor, {
  CATEGORY_GROUPS,
} from "@/components/workflow/CategoryGroupEditor";

const allCategories = CATEGORY_GROUPS.flatMap((g) => g.categories);
const makeValues = (qty = 10): Record<string, number> =>
  Object.fromEntries(allCategories.map((c) => [c, qty]));

describe("CategoryGroupEditor", () => {
  it("renders all 5 group headings", () => {
    render(<CategoryGroupEditor values={makeValues()} onChange={jest.fn()} />);
    CATEGORY_GROUPS.forEach((group) => {
      expect(screen.getByText(group.title)).toBeInTheDocument();
    });
  });

  it("renders an input for each of the 19 categories", () => {
    render(<CategoryGroupEditor values={makeValues()} onChange={jest.fn()} />);
    const inputs = screen.getAllByRole("spinbutton");  // type="number"
    expect(inputs.length).toBe(19);
  });

  it("displays the correct value for each category", () => {
    const values = { ...makeValues(0), Beverages: 42 };
    render(<CategoryGroupEditor values={values} onChange={jest.fn()} />);
    const beveragesInput = screen.getByLabelText("Beverages");
    expect(beveragesInput).toHaveValue(42);
  });

  it("calls onChange with correct category and value on input", () => {
    const onChange = jest.fn();
    render(<CategoryGroupEditor values={makeValues()} onChange={onChange} />);
    const beveragesInput = screen.getByLabelText("Beverages");
    fireEvent.change(beveragesInput, { target: { value: "25" } });
    expect(onChange).toHaveBeenCalledWith("Beverages", "25");
  });

  it("defaults missing values to 0", () => {
    render(<CategoryGroupEditor values={{}} onChange={jest.fn()} />);
    const inputs = screen.getAllByRole("spinbutton");
    inputs.forEach((input) => {
      expect(input).toHaveValue(0);
    });
  });

  it("all category labels are visible", () => {
    render(<CategoryGroupEditor values={makeValues()} onChange={jest.fn()} />);
    allCategories.forEach((cat) => {
      expect(screen.getByLabelText(cat)).toBeInTheDocument();
    });
  });

  it("applies custom inputPrefix to ids", () => {
    render(
      <CategoryGroupEditor
        values={makeValues()}
        onChange={jest.fn()}
        inputPrefix="test"
      />,
    );
    const bev = screen.getByLabelText("Beverages");
    expect(bev).toHaveAttribute("id", "test-Beverages");
  });

  it("uses default inputPrefix='cat'", () => {
    render(<CategoryGroupEditor values={makeValues()} onChange={jest.fn()} />);
    const bev = screen.getByLabelText("Beverages");
    expect(bev).toHaveAttribute("id", "cat-Beverages");
  });

  it("renders all 5 groups: Drinks, Proteins, Produce, Dry Goods, Flavor", () => {
    render(<CategoryGroupEditor values={makeValues()} onChange={jest.fn()} />);
    expect(screen.getByText("Drinks & Breakfast")).toBeInTheDocument();
    expect(screen.getByText("Proteins")).toBeInTheDocument();
    expect(screen.getByText("Produce & Soup")).toBeInTheDocument();
    expect(screen.getByText("Dry Goods")).toBeInTheDocument();
    expect(screen.getByText("Flavor & Other")).toBeInTheDocument();
  });
});
