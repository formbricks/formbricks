import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import { RankingRespone } from "./index";

describe("RankingResponse", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders ranked items correctly", () => {
    const rankedItems = ["Apple", "Banana", "Cherry"];

    render(<RankingRespone value={rankedItems} isExpanded={true} />);

    expect(screen.getByText("#1")).toBeInTheDocument();
    expect(screen.getByText("#2")).toBeInTheDocument();
    expect(screen.getByText("#3")).toBeInTheDocument();
    expect(screen.getByText("Apple")).toBeInTheDocument();
    expect(screen.getByText("Banana")).toBeInTheDocument();
    expect(screen.getByText("Cherry")).toBeInTheDocument();
  });

  test("applies expanded layout", () => {
    const rankedItems = ["Apple", "Banana"];

    const { container } = render(<RankingRespone value={rankedItems} isExpanded={true} />);

    const parentDiv = container.firstChild;
    expect(parentDiv).not.toHaveClass("flex");
    expect(parentDiv).not.toHaveClass("space-x-2");
  });

  test("applies non-expanded layout", () => {
    const rankedItems = ["Apple", "Banana"];

    const { container } = render(<RankingRespone value={rankedItems} isExpanded={false} />);

    const parentDiv = container.firstChild;
    expect(parentDiv).toHaveClass("flex");
    expect(parentDiv).toHaveClass("space-x-2");
  });

  test("handles empty values", () => {
    const rankedItems = ["Apple", "", "Cherry"];

    render(<RankingRespone value={rankedItems} isExpanded={true} />);

    expect(screen.getByText("#1")).toBeInTheDocument();
    expect(screen.getByText("#3")).toBeInTheDocument();
    expect(screen.getByText("Apple")).toBeInTheDocument();
    expect(screen.getByText("Cherry")).toBeInTheDocument();
    expect(screen.queryByText("#2")).not.toBeInTheDocument();
  });

  test("displays items in the correct order", () => {
    const rankedItems = ["First", "Second", "Third"];

    render(<RankingRespone value={rankedItems} isExpanded={true} />);

    const rankNumbers = screen.getAllByText(/^#\d$/);
    const rankItems = screen.getAllByText(/(First|Second|Third)/);

    expect(rankNumbers[0].textContent).toBe("#1");
    expect(rankItems[0].textContent).toBe("First");

    expect(rankNumbers[1].textContent).toBe("#2");
    expect(rankItems[1].textContent).toBe("Second");

    expect(rankNumbers[2].textContent).toBe("#3");
    expect(rankItems[2].textContent).toBe("Third");
  });

  test("renders with RTL support", () => {
    const rankedItems = ["תפוח", "בננה", "דובדבן"];

    const { container } = render(<RankingRespone value={rankedItems} isExpanded={true} />);

    const parentDiv = container.firstChild as HTMLElement;
    expect(parentDiv).toHaveAttribute("dir", "auto");
  });
});
