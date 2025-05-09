import "@testing-library/jest-dom/vitest";
import { render } from "@testing-library/preact";
import { describe, expect, test } from "vitest";
import { GlobeIcon } from "./globe-icon";

describe("GlobeIcon", () => {
  test("renders SVG with correct attributes", () => {
    const { container } = render(<GlobeIcon />);

    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute("xmlns", "http://www.w3.org/2000/svg");
    expect(svg).toHaveAttribute("viewBox", "0 0 24 24");
    expect(svg).toHaveAttribute("fill", "none");
    expect(svg).toHaveClass("lucide", "lucide-globe");
  });

  test("applies additional className", () => {
    const { container } = render(<GlobeIcon className="custom-class" />);
    const svg = container.querySelector("svg");
    expect(svg).toHaveClass("custom-class");
  });
});
