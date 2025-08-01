import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { RankingResponse } from "./index";

// Mock the IdBadge component
vi.mock("@/modules/ui/components/id-badge", () => ({
  IdBadge: ({ id }: { id: string }) => (
    <div data-testid="id-badge" data-id={id}>
      ID: {id}
    </div>
  ),
}));

describe("RankingResponse", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders ranked items correctly with new object format", () => {
    const rankedItems = [
      { value: "Apple", id: "choice1" },
      { value: "Banana", id: "choice2" },
      { value: "Cherry", id: "choice3" },
    ];

    render(<RankingResponse value={rankedItems} isExpanded={true} showId={false} />);

    expect(screen.getByText("#1")).toBeInTheDocument();
    expect(screen.getByText("#2")).toBeInTheDocument();
    expect(screen.getByText("#3")).toBeInTheDocument();
    expect(screen.getByText("Apple")).toBeInTheDocument();
    expect(screen.getByText("Banana")).toBeInTheDocument();
    expect(screen.getByText("Cherry")).toBeInTheDocument();
  });

  test("renders ranked items with undefined id", () => {
    const rankedItems = [
      { value: "Apple", id: "choice1" },
      { value: "Banana", id: undefined },
      { value: "Cherry", id: "choice3" },
    ];

    render(<RankingResponse value={rankedItems} isExpanded={true} showId={true} />);

    expect(screen.getByText("Apple")).toBeInTheDocument();
    expect(screen.getByText("Banana")).toBeInTheDocument();
    expect(screen.getByText("Cherry")).toBeInTheDocument();

    const idBadges = screen.getAllByTestId("id-badge");
    expect(idBadges).toHaveLength(2); // Only items with defined ids should have badges
    expect(idBadges[0]).toHaveAttribute("data-id", "choice1");
    expect(idBadges[1]).toHaveAttribute("data-id", "choice3");
  });

  test("shows IdBadge when showId=true", () => {
    const rankedItems = [
      { value: "Apple", id: "choice1" },
      { value: "Banana", id: "choice2" },
    ];

    render(<RankingResponse value={rankedItems} isExpanded={true} showId={true} />);

    const idBadges = screen.getAllByTestId("id-badge");
    expect(idBadges).toHaveLength(2);
    expect(idBadges[0]).toHaveAttribute("data-id", "choice1");
    expect(idBadges[1]).toHaveAttribute("data-id", "choice2");
  });

  test("does not show IdBadge when showId=false", () => {
    const rankedItems = [
      { value: "Apple", id: "choice1" },
      { value: "Banana", id: "choice2" },
    ];

    render(<RankingResponse value={rankedItems} isExpanded={true} showId={false} />);

    expect(screen.queryByTestId("id-badge")).not.toBeInTheDocument();
  });

  test("applies expanded layout", () => {
    const rankedItems = [
      { value: "Apple", id: "choice1" },
      { value: "Banana", id: "choice2" },
    ];

    const { container } = render(<RankingResponse value={rankedItems} isExpanded={true} showId={false} />);

    const parentDiv = container.firstChild;
    expect(parentDiv).not.toHaveClass("flex");
    expect(parentDiv).not.toHaveClass("space-x-2");
  });

  test("applies non-expanded layout", () => {
    const rankedItems = [
      { value: "Apple", id: "choice1" },
      { value: "Banana", id: "choice2" },
    ];

    const { container } = render(<RankingResponse value={rankedItems} isExpanded={false} showId={false} />);

    const parentDiv = container.firstChild;
    expect(parentDiv).toHaveClass("flex");
    expect(parentDiv).toHaveClass("space-x-2");
  });

  test("applies column layout when showId=true", () => {
    const rankedItems = [{ value: "Apple", id: "choice1" }];

    const { container } = render(<RankingResponse value={rankedItems} isExpanded={true} showId={true} />);

    const parentDiv = container.firstChild;
    expect(parentDiv).toHaveClass("flex-col");
  });

  test("does not apply column layout when showId=false", () => {
    const rankedItems = [{ value: "Apple", id: "choice1" }];

    const { container } = render(<RankingResponse value={rankedItems} isExpanded={true} showId={false} />);

    const parentDiv = container.firstChild;
    expect(parentDiv).not.toHaveClass("flex-col");
  });

  test("handles empty values", () => {
    const rankedItems = [
      { value: "Apple", id: "choice1" },
      { value: "", id: "choice2" },
      { value: "Cherry", id: "choice3" },
    ];

    render(<RankingResponse value={rankedItems} isExpanded={true} showId={false} />);

    expect(screen.getByText("#1")).toBeInTheDocument();
    expect(screen.getByText("#3")).toBeInTheDocument();
    expect(screen.getByText("Apple")).toBeInTheDocument();
    expect(screen.getByText("Cherry")).toBeInTheDocument();
    expect(screen.queryByText("#2")).not.toBeInTheDocument();
  });

  test("displays items in the correct order", () => {
    const rankedItems = [
      { value: "First", id: "choice1" },
      { value: "Second", id: "choice2" },
      { value: "Third", id: "choice3" },
    ];

    render(<RankingResponse value={rankedItems} isExpanded={true} showId={false} />);

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
    const rankedItems = [
      { value: "תפוח", id: "choice1" },
      { value: "בננה", id: "choice2" },
      { value: "דובדבן", id: "choice3" },
    ];

    const { container } = render(<RankingResponse value={rankedItems} isExpanded={true} showId={false} />);

    const parentDiv = container.firstChild as HTMLElement;
    expect(parentDiv).toHaveAttribute("dir", "auto");
  });

  test("renders items and badges together when showId=true", () => {
    const rankedItems = [
      { value: "First", id: "choice1" },
      { value: "Second", id: "choice2" },
    ];

    render(<RankingResponse value={rankedItems} isExpanded={true} showId={true} />);

    // Check that both items and badges are rendered
    expect(screen.getByText("First")).toBeInTheDocument();
    expect(screen.getByText("Second")).toBeInTheDocument();

    const idBadges = screen.getAllByTestId("id-badge");
    expect(idBadges).toHaveLength(2);
    expect(idBadges[0]).toHaveAttribute("data-id", "choice1");
    expect(idBadges[1]).toHaveAttribute("data-id", "choice2");
  });
});
