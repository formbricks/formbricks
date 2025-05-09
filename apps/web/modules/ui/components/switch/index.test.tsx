import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { Switch } from "./index";

// Mock radix-ui components
vi.mock("@radix-ui/react-switch", () => ({
  Root: ({ className, checked, onCheckedChange, disabled, id, "aria-label": ariaLabel }: any) => (
    <button
      data-testid="switch-root"
      className={className}
      data-state={checked ? "checked" : "unchecked"}
      onClick={() => !disabled && onCheckedChange && onCheckedChange(!checked)}
      disabled={disabled}
      id={id}
      aria-label={ariaLabel}>
      <span
        data-testid="switch-thumb"
        className="pointer-events-none block h-4 w-4 rounded-full bg-white shadow-lg ring-0 transition-transform data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0"
        data-state={checked ? "checked" : "unchecked"}
      />
    </button>
  ),
  Thumb: ({ className, checked }: any) => (
    <span data-testid="switch-thumb" className={className} data-state={checked ? "checked" : "unchecked"} />
  ),
}));

describe("Switch", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders default switch correctly", () => {
    render(<Switch />);

    const switchRoot = screen.getByTestId("switch-root");
    expect(switchRoot).toBeInTheDocument();

    // Check default state classes
    expect(switchRoot).toHaveClass("peer");
    expect(switchRoot).toHaveClass("inline-flex");
    expect(switchRoot).toHaveClass("rounded-full");
    expect(switchRoot).toHaveClass("border-2");

    // Check default state (unchecked)
    expect(switchRoot).toHaveAttribute("data-state", "unchecked");

    // Check thumb element
    const switchThumb = screen.getByTestId("switch-thumb");
    expect(switchThumb).toBeInTheDocument();
    expect(switchThumb).toHaveAttribute("data-state", "unchecked");
  });

  test("applies custom className", () => {
    render(<Switch className="custom-class" />);

    const switchRoot = screen.getByTestId("switch-root");
    expect(switchRoot).toHaveClass("custom-class");
  });

  test("renders in checked state", () => {
    render(<Switch checked />);

    const switchRoot = screen.getByTestId("switch-root");
    expect(switchRoot).toHaveAttribute("data-state", "checked");

    const switchThumb = screen.getByTestId("switch-thumb");
    expect(switchThumb).toHaveAttribute("data-state", "checked");
  });

  test("renders in disabled state", () => {
    render(<Switch disabled />);

    const switchRoot = screen.getByTestId("switch-root");
    expect(switchRoot).toBeDisabled();
  });

  test("handles onChange callback", async () => {
    const handleChange = vi.fn();
    const user = userEvent.setup();

    render(<Switch onCheckedChange={handleChange} />);

    const switchRoot = screen.getByTestId("switch-root");
    await user.click(switchRoot);

    expect(handleChange).toHaveBeenCalledTimes(1);
    expect(handleChange).toHaveBeenCalledWith(true);
  });

  test("doesn't trigger onChange when disabled", async () => {
    const handleChange = vi.fn();
    const user = userEvent.setup();

    render(<Switch disabled onCheckedChange={handleChange} />);

    const switchRoot = screen.getByTestId("switch-root");
    await user.click(switchRoot);

    expect(handleChange).not.toHaveBeenCalled();
  });

  test("passes props correctly", () => {
    render(<Switch id="test-switch" aria-label="Toggle" name="toggle" />);

    const switchRoot = screen.getByTestId("switch-root");
    expect(switchRoot).toHaveAttribute("id", "test-switch");
    expect(switchRoot).toHaveAttribute("aria-label", "Toggle");
  });
});
