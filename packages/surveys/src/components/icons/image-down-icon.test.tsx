import "@testing-library/jest-dom/vitest";
import { cleanup, render } from "@testing-library/preact";
import { afterEach, describe, expect, test } from "vitest";
import { ImageDownIcon } from "./image-down-icon";

describe("ImageDownIcon", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders SVG with correct attributes", () => {
    const { container } = render(<ImageDownIcon />);

    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute("xmlns", "http://www.w3.org/2000/svg");
    expect(svg).toHaveAttribute("viewBox", "0 0 24 24");
    expect(svg).toHaveAttribute("fill", "none");
    expect(svg).toHaveAttribute("aria-hidden", "true");
  });

  test("applies additional className", () => {
    const { container } = render(<ImageDownIcon className="custom-class" />);
    const svg = container.querySelector("svg");
    expect(svg).toHaveClass("custom-class");
  });
});
