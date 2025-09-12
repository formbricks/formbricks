import "@testing-library/jest-dom/vitest";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import { FormbricksLogo } from "./index";

describe("FormbricksLogo", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders the logo SVG element", () => {
    render(<FormbricksLogo />);

    const svgElement = document.querySelector("svg");
    expect(svgElement).toBeInTheDocument();
    expect(svgElement?.tagName).toBe("svg");
  });

  test("has correct default SVG attributes", () => {
    render(<FormbricksLogo />);

    const svgElement = document.querySelector("svg");
    expect(svgElement).toHaveAttribute("width", "220");
    expect(svgElement).toHaveAttribute("height", "220");
    expect(svgElement).toHaveAttribute("viewBox", "0 0 220 220");
    expect(svgElement).toHaveAttribute("fill", "none");
    expect(svgElement).toHaveAttribute("xmlns", "http://www.w3.org/2000/svg");
  });

  test("applies custom classes when provided", () => {
    const customClasses = "custom-class-1 custom-class-2 text-blue-500";
    render(<FormbricksLogo className={customClasses} />);

    const svgElement = document.querySelector("svg");
    expect(svgElement).toHaveClass("custom-class-1");
    expect(svgElement).toHaveClass("custom-class-2");
    expect(svgElement).toHaveClass("text-blue-500");
  });

  test("renders without className when not provided", () => {
    render(<FormbricksLogo />);

    const svgElement = document.querySelector("svg");
    expect(svgElement).not.toHaveAttribute("class");
  });

  test("contains the correct number of path elements", () => {
    render(<FormbricksLogo />);

    // The SVG contains multiple path elements (main paths + mask paths)
    const svgElement = document.querySelector("svg");
    const pathElements = svgElement?.querySelectorAll("path");
    expect(pathElements).toHaveLength(10); // 3 main + 3 mask + 3 inner mask + 1 shadow path
  });

  test("contains gradient definitions", () => {
    render(<FormbricksLogo />);

    const svgElement = document.querySelector("svg");
    const gradients = svgElement?.querySelectorAll("linearGradient");
    expect(gradients).toHaveLength(6); // 6 linear gradients defined
  });

  test("contains filter definitions", () => {
    render(<FormbricksLogo />);

    const svgElement = document.querySelector("svg");
    const filters = svgElement?.querySelectorAll("filter");
    expect(filters).toHaveLength(3); // 3 filters defined
  });

  test("has proper mask elements", () => {
    render(<FormbricksLogo />);

    const svgElement = document.querySelector("svg");
    const masks = svgElement?.querySelectorAll("mask");
    expect(masks).toHaveLength(2); // 2 masks defined
  });

  test("contains circles for the blur effects", () => {
    render(<FormbricksLogo />);

    const svgElement = document.querySelector("svg");
    const circles = svgElement?.querySelectorAll("circle");
    expect(circles).toHaveLength(2); // 2 circles for blur effects
  });

  test("has correct fill URLs for main paths", () => {
    render(<FormbricksLogo />);

    const svgElement = document.querySelector("svg");
    const paths = svgElement?.querySelectorAll("path");

    // Check that the main paths have the correct gradient fills
    expect(paths?.[0]).toHaveAttribute("fill", "url(#paint0_linear_415_2)");
    expect(paths?.[1]).toHaveAttribute("fill", "url(#paint1_linear_415_2)");
    expect(paths?.[2]).toHaveAttribute("fill", "url(#paint2_linear_415_2)");
  });

  test("has correct circle attributes for blur effects", () => {
    render(<FormbricksLogo />);

    const svgElement = document.querySelector("svg");
    const circles = svgElement?.querySelectorAll("circle");

    // First circle (bottom blur effect)
    expect(circles?.[0]).toHaveAttribute("cx", "21.4498");
    expect(circles?.[0]).toHaveAttribute("cy", "179.212");
    expect(circles?.[0]).toHaveAttribute("r", "53.13");
    expect(circles?.[0]).toHaveAttribute("fill", "#00C4B8");

    // Second circle (top blur effect)
    expect(circles?.[1]).toHaveAttribute("cx", "21.4498");
    expect(circles?.[1]).toHaveAttribute("cy", "44.6163");
    expect(circles?.[1]).toHaveAttribute("r", "53.13");
    expect(circles?.[1]).toHaveAttribute("fill", "#00C4B8");
  });

  test("maintains proper structure with defs section", () => {
    render(<FormbricksLogo />);

    const svgElement = document.querySelector("svg");
    const defsSection = svgElement?.querySelector("defs");

    expect(defsSection).toBeInTheDocument();
    expect(defsSection?.children).toHaveLength(9); // 3 filters + 6 gradients
  });

  test("has proper gradient stop colors", () => {
    render(<FormbricksLogo />);

    const svgElement = document.querySelector("svg");
    const gradients = svgElement?.querySelectorAll("linearGradient");

    // Check first gradient stops (HTML uses stop-color instead of stopColor)
    const firstGradientStops = gradients?.[0].querySelectorAll("stop");
    expect(firstGradientStops?.[0]).toHaveAttribute("offset", "1");
    expect(firstGradientStops?.[0]).toHaveAttribute("stop-color", "#00C4B8");

    // Check second gradient stops
    const secondGradientStops = gradients?.[1].querySelectorAll("stop");
    expect(secondGradientStops?.[0]).toHaveAttribute("stop-color", "#00DDD0");
    expect(secondGradientStops?.[1]).toHaveAttribute("offset", "1");
    expect(secondGradientStops?.[1]).toHaveAttribute("stop-color", "#01E0C6");
  });

  test("preserves SVG structure integrity", () => {
    render(<FormbricksLogo />);

    const svgElement = document.querySelector("svg");

    // Verify the SVG has the expected structure (3 main paths + mask + group + defs)
    expect(svgElement?.children).toHaveLength(6); // 3 paths + 1 mask + 1 group + 1 defs

    // Verify defs section exists and contains definitions
    const defsSection = svgElement?.querySelector("defs");
    expect(defsSection).toBeInTheDocument();

    // Verify paths exist
    const paths = svgElement?.querySelectorAll("path");
    expect(paths?.length).toBeGreaterThan(0);

    // Verify gradients exist
    const gradients = svgElement?.querySelectorAll("linearGradient");
    expect(gradients?.length).toBeGreaterThan(0);
  });
});
