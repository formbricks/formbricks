import "@testing-library/jest-dom/vitest";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import { LoadingSpinner } from ".";

describe("LoadingSpinner", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders with default className", () => {
    render(<LoadingSpinner />);

    const svg = document.querySelector("svg");
    expect(svg).toBeInTheDocument();
    expect(svg?.classList.contains("h-6")).toBe(true);
    expect(svg?.classList.contains("w-6")).toBe(true);
    expect(svg?.classList.contains("m-2")).toBe(true);
    expect(svg?.classList.contains("animate-spin")).toBe(true);
    expect(svg?.classList.contains("text-slate-700")).toBe(true);
  });

  test("renders with custom className", () => {
    render(<LoadingSpinner className="h-10 w-10" />);

    const svg = document.querySelector("svg");
    expect(svg).toBeInTheDocument();
    expect(svg?.classList.contains("h-10")).toBe(true);
    expect(svg?.classList.contains("w-10")).toBe(true);
    expect(svg?.classList.contains("m-2")).toBe(true);
    expect(svg?.classList.contains("animate-spin")).toBe(true);
    expect(svg?.classList.contains("text-slate-700")).toBe(true);
  });

  test("renders with correct SVG structure", () => {
    render(<LoadingSpinner />);

    const svg = document.querySelector("svg");
    expect(svg).toBeInTheDocument();

    // Check that SVG has correct attributes
    expect(svg?.getAttribute("xmlns")).toBe("http://www.w3.org/2000/svg");
    expect(svg?.getAttribute("fill")).toBe("none");
    expect(svg?.getAttribute("viewBox")).toBe("0 0 24 24");

    // Check that SVG contains circle and path elements
    const circle = svg?.querySelector("circle");
    const path = svg?.querySelector("path");

    expect(circle).toBeInTheDocument();
    expect(path).toBeInTheDocument();

    // Check circle attributes
    expect(circle?.getAttribute("cx")).toBe("12");
    expect(circle?.getAttribute("cy")).toBe("12");
    expect(circle?.getAttribute("r")).toBe("10");
    expect(circle?.getAttribute("stroke")).toBe("currentColor");
    expect(circle?.classList.contains("opacity-25")).toBe(true);

    // Check path attributes
    expect(path?.getAttribute("fill")).toBe("currentColor");
    expect(path?.classList.contains("opacity-75")).toBe(true);
  });
});
