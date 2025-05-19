import "@testing-library/jest-dom/vitest";
import { cleanup, render } from "@testing-library/preact";
import { afterEach, describe, expect, test } from "vitest";
import { AutoCloseProgressBar } from "./auto-close-progress-bar";

describe("AutoCloseProgressBar", () => {
  afterEach(() => {
    cleanup();
  });
  test("renders with correct timeout animation", () => {
    const timeout = 5;
    const { container } = render(<AutoCloseProgressBar autoCloseTimeout={timeout} />);

    const progressBar = container.querySelector(".fb-bg-brand");
    expect(progressBar).toBeInTheDocument();

    expect(progressBar).toHaveStyle({
      animation: `shrink-width-to-zero ${timeout}s linear forwards`,
      width: "100%",
    });
  });

  test("renders with correct base styling", () => {
    const { container } = render(<AutoCloseProgressBar autoCloseTimeout={3} />);

    const wrapper = container.firstChild;
    expect(wrapper).toHaveClass("fb-bg-accent-bg", "fb-h-2", "fb-w-full", "fb-overflow-hidden");

    const progressBar = container.querySelector(".fb-bg-brand");
    expect(progressBar).toHaveClass("fb-bg-brand", "fb-z-20", "fb-h-2");
  });

  test("updates animation when timeout changes", () => {
    const { container, rerender } = render(<AutoCloseProgressBar autoCloseTimeout={3} />);

    const firstProgressBar = container.querySelector(".fb-bg-brand");
    expect(firstProgressBar).toHaveStyle({
      animation: "shrink-width-to-zero 3s linear forwards",
    });

    rerender(<AutoCloseProgressBar autoCloseTimeout={5} />);

    const secondProgressBar = container.querySelector(".fb-bg-brand");
    expect(secondProgressBar).toHaveStyle({
      animation: "shrink-width-to-zero 5s linear forwards",
    });
  });
});
