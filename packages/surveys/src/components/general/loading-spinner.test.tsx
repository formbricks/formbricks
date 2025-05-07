import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/preact";
import { afterEach, describe, expect, test } from "vitest";
import { LoadingSpinner } from "./loading-spinner";

describe("LoadingSpinner", () => {
  afterEach(() => {
    cleanup();
  });
  test("renders with default classes", () => {
    render(<LoadingSpinner />);

    const spinner = screen.getAllByTestId("loading-spinner")[0];
    expect(spinner).toBeInTheDocument();
    expect(spinner).toHaveClass("fb-flex", "fb-h-full", "fb-w-full", "fb-items-center", "fb-justify-center");
  });

  test("renders with additional className", () => {
    render(<LoadingSpinner className="custom-class" />);

    const spinner = screen.getAllByTestId("loading-spinner")[0];
    expect(spinner).toHaveClass("custom-class");
  });

  test("renders svg with correct attributes", () => {
    const { container } = render(<LoadingSpinner />);

    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveClass("fb-m-2", "fb-h-6", "fb-w-6", "fb-animate-spin", "fb-text-brand");
    expect(svg).toHaveAttribute("viewBox", "0 0 24 24");
    expect(svg).toHaveAttribute("fill", "none");
  });

  test("renders circle and path elements with correct classes", () => {
    const { container } = render(<LoadingSpinner />);

    const circle = container.querySelector("circle");
    expect(circle).toBeInTheDocument();
    expect(circle).toHaveClass("fb-opacity-25");
    expect(circle).toHaveAttribute("cx", "12");
    expect(circle).toHaveAttribute("cy", "12");
    expect(circle).toHaveAttribute("r", "10");
    expect(circle).toHaveAttribute("stroke", "currentColor");
    expect(circle).toHaveAttribute("strokeWidth", "4");

    const path = container.querySelector("path");
    expect(path).toBeInTheDocument();
    expect(path).toHaveClass("fb-opacity-75");
    expect(path).toHaveAttribute("fill", "currentColor");
  });
});
