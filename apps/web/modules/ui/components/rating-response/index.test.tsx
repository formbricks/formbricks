import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { RatingResponse } from "./index";

// Mock the RatingSmiley component
vi.mock("@/modules/analysis/components/RatingSmiley", () => ({
  RatingSmiley: ({ active, idx, range, addColors }: any) => (
    <div
      data-testid="rating-smiley"
      data-active={active}
      data-idx={idx}
      data-range={range}
      data-add-colors={addColors ? "true" : "false"}>
      Smiley Rating
    </div>
  ),
}));

describe("RatingResponse", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders null when answer is not a number", () => {
    const { container } = render(<RatingResponse scale="number" range={5} answer="not a number" />);
    expect(container.firstChild).toBeNull();
  });

  test("returns raw answer when scale or range is undefined", () => {
    const { container } = render(<RatingResponse answer={3} />);
    expect(container).toHaveTextContent("3");
  });

  test("renders smiley rating correctly", () => {
    render(<RatingResponse scale="smiley" range={5} answer={3} />);

    const smiley = screen.getByTestId("rating-smiley");
    expect(smiley).toBeInTheDocument();
    expect(smiley).toHaveAttribute("data-active", "false");
    expect(smiley).toHaveAttribute("data-idx", "2"); // 0-based index for rating 3
    expect(smiley).toHaveAttribute("data-range", "5");
    expect(smiley).toHaveAttribute("data-add-colors", "false");
  });

  test("renders smiley rating with colors", () => {
    render(<RatingResponse scale="smiley" range={5} answer={3} addColors={true} />);

    const smiley = screen.getByTestId("rating-smiley");
    expect(smiley).toBeInTheDocument();
    expect(smiley).toHaveAttribute("data-add-colors", "true");
  });

  test("renders number rating correctly", () => {
    const { container } = render(<RatingResponse scale="number" range={10} answer={7} />);
    expect(container).toHaveTextContent("7");
  });

  test("handles full rating correctly", () => {
    render(<RatingResponse scale="star" range={5} answer={5} />);

    const stars = document.querySelectorAll("svg");
    expect(stars).toHaveLength(5);

    // All stars should be filled
    for (let i = 0; i < 5; i++) {
      expect(stars[i].getAttribute("fill")).toBe("rgb(250 204 21)");
      expect(stars[i]).toHaveClass("text-yellow-400");
    }
  });
});
