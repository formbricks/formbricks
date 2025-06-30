import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { Confetti } from "./index";

// Mock ReactConfetti component
vi.mock("react-confetti", () => ({
  default: vi.fn((props) => (
    <div
      data-testid="mock-confetti"
      data-width={props.width}
      data-height={props.height}
      data-colors={JSON.stringify(props.colors)}
      data-number-of-pieces={props.numberOfPieces}
      data-recycle={props.recycle}
      style={props.style}
    />
  )),
}));

// Mock useWindowSize hook
vi.mock("react-use", () => ({
  useWindowSize: () => ({ width: 1024, height: 768 }),
}));

describe("Confetti", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders with default props", () => {
    render(<Confetti />);

    const confettiElement = screen.getByTestId("mock-confetti");
    expect(confettiElement).toBeInTheDocument();
    expect(confettiElement).toHaveAttribute("data-width", "1024");
    expect(confettiElement).toHaveAttribute("data-height", "768");
    expect(confettiElement).toHaveAttribute("data-colors", JSON.stringify(["#00C4B8", "#eee"]));
    expect(confettiElement).toHaveAttribute("data-number-of-pieces", "400");
    expect(confettiElement).toHaveAttribute("data-recycle", "false");
    expect(confettiElement).toHaveAttribute(
      "style",
      "position: fixed; top: 0px; left: 0px; z-index: 9999; pointer-events: none;"
    );
  });

  test("renders with custom colors", () => {
    const customColors = ["#FF0000", "#00FF00", "#0000FF"];
    render(<Confetti colors={customColors} />);

    const confettiElement = screen.getByTestId("mock-confetti");
    expect(confettiElement).toBeInTheDocument();
    expect(confettiElement).toHaveAttribute("data-colors", JSON.stringify(customColors));
  });
});
