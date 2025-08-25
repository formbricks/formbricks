import "@testing-library/jest-dom/vitest";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import { Logo } from ".";

describe("Logo", () => {
  afterEach(() => {
    cleanup();
  });

  describe("default variant", () => {
    test("renders default logo correctly", () => {
      const { container } = render(<Logo />);
      const svg = container.querySelector("svg");

      expect(svg).toBeInTheDocument();
    });
  });

  describe("image variant", () => {
    test("renders image logo correctly", () => {
      const { container } = render(<Logo variant="image" />);
      const svg = container.querySelector("svg");

      expect(svg).toBeInTheDocument();
    });

    test("renders image logo with className correctly", () => {
      const testClassName = "test-class";
      const { container } = render(<Logo variant="image" className={testClassName} />);
      const svg = container.querySelector("svg");

      expect(svg).toBeInTheDocument();
      expect(svg).toHaveAttribute("class", testClassName);
    });
  });

  describe("wordmark variant", () => {
    test("renders wordmark logo correctly", () => {
      const { container } = render(<Logo variant="wordmark" />);
      const svg = container.querySelector("svg");

      expect(svg).toBeInTheDocument();
    });

    test("renders wordmark logo with className correctly", () => {
      const testClassName = "test-class";
      const { container } = render(<Logo variant="wordmark" className={testClassName} />);
      const svg = container.querySelector("svg");

      expect(svg).toBeInTheDocument();
      expect(svg).toHaveAttribute("class", testClassName);
    });

    test("contains expected svg elements", () => {
      const { container } = render(<Logo variant="wordmark" />);
      const svg = container.querySelector("svg");

      expect(svg?.querySelectorAll("path").length).toBeGreaterThan(0);
      expect(svg?.querySelector("line")).toBeInTheDocument();
      expect(svg?.querySelectorAll("mask").length).toBe(2);
      expect(svg?.querySelectorAll("filter").length).toBe(3);
      expect(svg?.querySelectorAll("linearGradient").length).toBe(6);
    });
  });
});
