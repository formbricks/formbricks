import "@testing-library/jest-dom/vitest";
import { cleanup, render } from "@testing-library/preact";
import { afterEach, describe, expect, test } from "vitest";
import { Progress } from "./progress";

describe("Progress", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders with correct base classes", () => {
    const { container } = render(<Progress progress={0.5} />);

    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper).toHaveClass("fb-bg-accent-bg", "fb-h-2", "fb-w-full", "fb-rounded-none");
  });

  test("renders progress bar with correct classes", () => {
    const { container } = render(<Progress progress={0.5} />);

    const wrapper = container.querySelector("div");
    expect(wrapper).not.toBeNull();
    const progressBar = wrapper!.lastChild as HTMLElement;
    expect(progressBar).toHaveClass(
      "fb-transition-width",
      "fb-bg-brand",
      "fb-z-20",
      "fb-h-2",
      "fb-duration-500"
    );
  });

  test.each([
    { input: 0, expected: "0%" },
    { input: 0.5, expected: "50%" },
    { input: 0.75, expected: "75%" },
    { input: 1, expected: "100%" },
  ])("sets correct width style for progress $input", ({ input, expected }) => {
    const { container } = render(<Progress progress={input} />);

    const wrapper = container.querySelector("div");
    expect(wrapper).not.toBeNull();
    const progressBar = wrapper!.lastChild as HTMLElement;
    expect(progressBar).toHaveStyle({ width: expected });
  });

  test("handles decimal values by flooring the percentage", () => {
    const { container } = render(<Progress progress={0.666} />);

    const wrapper = container.querySelector("div");
    expect(wrapper).not.toBeNull();
    const progressBar = wrapper!.lastChild as HTMLElement;
    expect(progressBar).toHaveStyle({ width: "66%" });
  });
});
