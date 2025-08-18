import "@testing-library/jest-dom/vitest";
import { cleanup, render } from "@testing-library/preact";
import { afterEach, describe, expect, test } from "vitest";
import { LanguageIcon } from "./language-icon";

describe("LanguageIcon", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders SVG with correct attributes", () => {
    const { container } = render(<LanguageIcon />);

    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute("xmlns", "http://www.w3.org/2000/svg");
    expect(svg).toHaveAttribute("viewBox", "0 0 16 16");
    expect(svg).toHaveAttribute("fill", "none");
    expect(svg).toHaveAttribute("aria-hidden", "true");

    const path = svg?.querySelector("path");
    expect(path).toBeInTheDocument();
    expect(path).toHaveAttribute("stroke", "currentColor");
    expect(path).toHaveAttribute("strokeWidth", "1.33");
    expect(path).toHaveAttribute("strokeLinecap", "round");
    expect(path).toHaveAttribute("strokeLinejoin", "round");
  });

  test("applies additional className", () => {
    const { container } = render(<LanguageIcon className="custom-class" />);
    const svg = container.querySelector("svg");
    expect(svg).toHaveClass("custom-class");
  });
});
