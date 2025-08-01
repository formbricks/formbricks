import "@testing-library/jest-dom/vitest";
import { render } from "@testing-library/preact";
import { describe, expect, test } from "vitest";
import { CloseIcon } from "./close-icon";

describe("CloseIcon", () => {
  test("renders SVG with correct attributes", () => {
    const { container } = render(<CloseIcon />);

    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute("xmlns", "http://www.w3.org/2000/svg");
    expect(svg).toHaveAttribute("viewBox", "0 0 16 16");
    expect(svg).toHaveAttribute("fill", "none");
    expect(svg).toHaveAttribute("aria-hidden", "true");

    const path = svg?.querySelector("path");
    expect(path).toBeInTheDocument();
    expect(path).toHaveAttribute("stroke", "currentColor");
    expect(path).toHaveAttribute("d", "M12 4L4 12M4 4L12 12");
  });

  test("applies additional className", () => {
    const { container } = render(<CloseIcon className="custom-class" />);
    const svg = container.querySelector("svg");
    expect(svg).toHaveClass("custom-class");
  });
});
