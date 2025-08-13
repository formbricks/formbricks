import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/preact";
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
    expect(wrapper).toHaveClass("fb-z-[1001]", "fb-flex", "fb-w-fit", "fb-items-center");

    const button = wrapper.querySelector("button");
    expect(button).toBeInTheDocument();
    expect(button).toHaveClass("fb-text-heading", "fb-relative", "fb-h-8", "fb-w-8");
    expect(button).toHaveAttribute("aria-label", "Close survey");

    const backgroundColor = button?.style?.backgroundColor;
    expect(backgroundColor).toBe("transparent");
  });

  test("renders close button with correct hover color", () => {
    const { container } = render(<SurveyCloseButton hoverColor="#008080" />);

    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper).toHaveClass("fb-z-[1001]", "fb-flex", "fb-w-fit", "fb-items-center");

    const button = wrapper.querySelector("button");
    expect(button).toBeInTheDocument();
    expect(button).toHaveClass("fb-text-heading", "fb-relative", "fb-h-8", "fb-w-8");
    expect(button).toHaveAttribute("aria-label", "Close survey");

    // hover over the button
    fireEvent.mouseEnter(button as HTMLButtonElement);
    const backgroundColor = button?.style?.backgroundColor;

    expect(backgroundColor).toBe("rgb(0, 128, 128)");
  });

  test("renders close button with correct border radius", () => {
    const { container } = render(<SurveyCloseButton borderRadius={12} />);

    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper).toHaveClass("fb-z-[1001]", "fb-flex", "fb-w-fit", "fb-items-center");

    const button = wrapper.querySelector("button");
    expect(button).toBeInTheDocument();
    expect(button).toHaveClass("fb-text-heading", "fb-relative", "fb-h-8", "fb-w-8");
    expect(button).toHaveAttribute("aria-label", "Close survey");
    expect(button).toHaveStyle({
      borderRadius: "12px",
    });
  });

  test("renders SVG icon with correct attributes", () => {
    const { container } = render(<SurveyCloseButton />);

    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute("viewBox", "0 0 16 16");
    expect(svg).toHaveAttribute("aria-hidden", "true");

    const path = svg?.querySelector("path");
    expect(path).toBeInTheDocument();
    expect(path).toHaveAttribute("stroke", "currentColor");
    expect(path).toHaveAttribute("d", "M12 4L4 12M4 4L12 12");
    expect(path).toHaveAttribute("strokeWidth", "1.33");
    expect(path).toHaveAttribute("strokeLinecap", "round");
    expect(path).toHaveAttribute("strokeLinejoin", "round");
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
