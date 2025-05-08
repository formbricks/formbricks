import "@testing-library/jest-dom/vitest";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import { Logo } from ".";

describe("Logo", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders correctly", () => {
    const { container } = render(<Logo />);
    const svg = container.querySelector("svg");

    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute("viewBox", "0 0 697 150");
    expect(svg).toHaveAttribute("fill", "none");
    expect(svg).toHaveAttribute("xmlns", "http://www.w3.org/2000/svg");
  });

  test("accepts and passes through props", () => {
    const testClassName = "test-class";
    const { container } = render(<Logo className={testClassName} />);
    const svg = container.querySelector("svg");

    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute("class", testClassName);
  });

  test("contains expected svg elements", () => {
    const { container } = render(<Logo />);
    const svg = container.querySelector("svg");

    expect(svg?.querySelectorAll("path").length).toBeGreaterThan(0);
    expect(svg?.querySelector("line")).toBeInTheDocument();
    expect(svg?.querySelectorAll("mask").length).toBe(2);
    expect(svg?.querySelectorAll("filter").length).toBe(3);
    expect(svg?.querySelectorAll("linearGradient").length).toBe(6);
  });
});
