import { render } from "@testing-library/react";
import Skeleton from "@/components/ui/Skeleton";

describe("Skeleton", () => {
  it("renders a div", () => {
    const { container } = render(<Skeleton />);
    expect(container.firstChild).toBeInstanceOf(HTMLDivElement);
  });

  it("has aria-hidden attribute for screen reader exclusion", () => {
    const { container } = render(<Skeleton />);
    const el = container.firstChild as HTMLElement;
    expect(el).toHaveAttribute("aria-hidden");
  });

  it("applies custom className", () => {
    const { container } = render(<Skeleton className="h-4 w-48" />);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain("h-4");
    expect(el.className).toContain("w-48");
  });

  it("has shimmer animation child element", () => {
    const { container } = render(<Skeleton />);
    // The inner div for shimmer exists (class may vary based on Tailwind v4 compilation)
    // Just verify there is an inner element
    expect(container.firstChild?.childNodes.length).toBeGreaterThan(0);
  });

  it("renders without crash when no className", () => {
    expect(() => render(<Skeleton />)).not.toThrow();
  });

  it("has base rounded and bg classes", () => {
    const { container } = render(<Skeleton />);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain("rounded-lg");
    expect(el.className).toContain("bg-slate-200");
  });

  it("multiple Skeleton instances render independently", () => {
    const { container } = render(
      <div>
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-3 w-40" />
      </div>,
    );
    const skeletons = container.querySelectorAll("[aria-hidden]");
    expect(skeletons.length).toBe(3);
  });
});
