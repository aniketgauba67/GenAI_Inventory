import { render, screen } from "@testing-library/react";
import LevelBadge from "@/components/inventory/LevelBadge";

describe("LevelBadge", () => {
  describe("short text (default)", () => {
    it("renders 'High' text for High level", () => {
      render(<LevelBadge level="High" />);
      expect(screen.getByText("High")).toBeInTheDocument();
    });

    it("renders 'Medium' text for Mid level", () => {
      render(<LevelBadge level="Mid" />);
      expect(screen.getByText("Medium")).toBeInTheDocument();
    });

    it("renders 'Low' text for Low level", () => {
      render(<LevelBadge level="Low" />);
      expect(screen.getByText("Low")).toBeInTheDocument();
    });

    it("renders 'Out' text for Out level", () => {
      render(<LevelBadge level="Out" />);
      expect(screen.getByText("Out")).toBeInTheDocument();
    });
  });

  describe("friendly text mode", () => {
    it("renders 'High stock' for High level", () => {
      render(<LevelBadge level="High" friendlyText />);
      expect(screen.getByText("High stock")).toBeInTheDocument();
    });

    it("renders 'Medium stock' for Mid level", () => {
      render(<LevelBadge level="Mid" friendlyText />);
      expect(screen.getByText("Medium stock")).toBeInTheDocument();
    });

    it("renders 'Needs restock' for Low level", () => {
      render(<LevelBadge level="Low" friendlyText />);
      expect(screen.getByText("Needs restock")).toBeInTheDocument();
    });

    it("renders 'Out of stock' for Out level", () => {
      render(<LevelBadge level="Out" friendlyText />);
      expect(screen.getByText("Out of stock")).toBeInTheDocument();
    });
  });

  describe("accessibility", () => {
    it("has role=img", () => {
      render(<LevelBadge level="High" />);
      expect(screen.getByRole("img")).toBeInTheDocument();
    });

    it("has descriptive aria-label for High", () => {
      render(<LevelBadge level="High" />);
      expect(screen.getByRole("img")).toHaveAttribute(
        "aria-label",
        "Stock level: High",
      );
    });

    it("has descriptive aria-label for Mid", () => {
      render(<LevelBadge level="Mid" />);
      expect(screen.getByRole("img")).toHaveAttribute(
        "aria-label",
        "Stock level: Medium",
      );
    });

    it("aria-label uses friendly text when friendlyText=true", () => {
      render(<LevelBadge level="Low" friendlyText />);
      expect(screen.getByRole("img")).toHaveAttribute(
        "aria-label",
        "Stock level: Needs restock",
      );
    });
  });

  describe("unknown level fallback", () => {
    it("renders Out for unknown level string", () => {
      render(<LevelBadge level="Unknown" />);
      // Falls back to levelLabels.Out → "Out"
      expect(screen.getByText("Out")).toBeInTheDocument();
    });
  });

  describe("size prop", () => {
    it("sm size applies smaller classes by default", () => {
      render(<LevelBadge level="High" size="sm" />);
      const badge = screen.getByRole("img");
      expect(badge.className).toContain("min-w-14");
    });

    it("lg size applies larger classes", () => {
      render(<LevelBadge level="High" size="lg" />);
      const badge = screen.getByRole("img");
      expect(badge.className).toContain("min-w-28");
    });
  });

  describe("color styling", () => {
    it("High level has emerald class", () => {
      render(<LevelBadge level="High" />);
      expect(screen.getByRole("img").className).toContain("emerald");
    });

    it("Mid level has amber class", () => {
      render(<LevelBadge level="Mid" />);
      expect(screen.getByRole("img").className).toContain("amber");
    });

    it("Low level has rose class", () => {
      render(<LevelBadge level="Low" />);
      expect(screen.getByRole("img").className).toContain("rose");
    });

    it("Out level has zinc class", () => {
      render(<LevelBadge level="Out" />);
      expect(screen.getByRole("img").className).toContain("zinc");
    });
  });
});
