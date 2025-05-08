import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/preact";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { SurveyCloseButton } from "./survey-close-button";

describe("SurveyCloseButton", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders close button with correct base structure", () => {
    const { container } = render(<SurveyCloseButton />);

    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper).toHaveClass(
      "fb-z-[1001]",
      "fb-flex",
      "fb-w-fit",
      "fb-items-center",
      "even:fb-border-l",
      "even:fb-pl-1"
    );

    const button = wrapper.querySelector("button");
    expect(button).toBeInTheDocument();
    expect(button).toHaveClass("fb-text-heading", "fb-relative", "fb-h-6", "fb-w-6", "fb-rounded-md");
  });

  test("renders SVG icon with correct attributes", () => {
    const { container } = render(<SurveyCloseButton />);

    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveClass("fb-h-6", "fb-w-6", "fb-p-0.5");
    expect(svg).toHaveAttribute("viewBox", "0 0 24 24");
    expect(svg).toHaveAttribute("stroke", "currentColor");
    expect(svg).toHaveAttribute("aria-hidden", "true");

    const path = svg?.querySelector("path");
    expect(path).toBeInTheDocument();
    expect(path).toHaveAttribute("strokeLinecap", "round");
    expect(path).toHaveAttribute("strokeLinejoin", "round");
    expect(path).toHaveAttribute("d", "M4 4L20 20M4 20L20 4");
  });

  test("calls onClose when clicked", async () => {
    const handleClose = vi.fn();
    render(<SurveyCloseButton onClose={handleClose} />);

    const button = screen.getByRole("button");
    await userEvent.click(button);

    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  test("does not throw when clicked without onClose handler", async () => {
    render(<SurveyCloseButton />);

    const button = screen.getByRole("button");
    await userEvent.click(button);
    // Test passes if no error is thrown
  });
});
