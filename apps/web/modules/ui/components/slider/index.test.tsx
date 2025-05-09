import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { Slider } from "./index";

// Mock Radix UI Slider components
vi.mock("@radix-ui/react-slider", () => ({
  Root: ({ className, defaultValue, value, onValueChange, disabled, ...props }: any) => (
    <div
      data-testid="slider-root"
      className={className}
      data-value={value || defaultValue}
      data-disabled={disabled}
      onClick={(e) => {
        if (!disabled && onValueChange) {
          // Simulate slider change on click (simplified for testing)
          const newValue = value ? [value[0] + 10] : [50];
          onValueChange(newValue);
        }
      }}
      {...props}
    />
  ),
  Track: ({ className, children }: any) => (
    <div data-testid="slider-track" className={className}>
      {children}
    </div>
  ),
  Range: ({ className }: any) => <div data-testid="slider-range" className={className} />,
  Thumb: ({ className }: any) => <div data-testid="slider-thumb" className={className} />,
}));

describe("Slider", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders with default props", () => {
    render(<Slider />);

    expect(screen.getByTestId("slider-root")).toBeInTheDocument();
    expect(screen.getByTestId("slider-track")).toBeInTheDocument();
    expect(screen.getByTestId("slider-range")).toBeInTheDocument();
    expect(screen.getByTestId("slider-thumb")).toBeInTheDocument();
  });

  test("applies custom className", () => {
    render(<Slider className="custom-class" />);

    const sliderRoot = screen.getByTestId("slider-root");
    expect(sliderRoot).toHaveClass("custom-class");
    expect(sliderRoot).toHaveClass("relative");
    expect(sliderRoot).toHaveClass("flex");
    expect(sliderRoot).toHaveClass("w-full");
  });

  test("accepts defaultValue prop", () => {
    render(<Slider defaultValue={[25]} />);

    const sliderRoot = screen.getByTestId("slider-root");
    expect(sliderRoot).toHaveAttribute("data-value", "25");
  });

  test("handles value changes", async () => {
    const handleValueChange = vi.fn();
    const user = userEvent.setup();

    render(<Slider value={[30]} onValueChange={handleValueChange} />);

    const sliderRoot = screen.getByTestId("slider-root");
    expect(sliderRoot).toHaveAttribute("data-value", "30");

    await user.click(sliderRoot);

    expect(handleValueChange).toHaveBeenCalledWith([40]);
  });

  test("renders in disabled state", () => {
    render(<Slider disabled />);

    const sliderRoot = screen.getByTestId("slider-root");
    expect(sliderRoot).toHaveAttribute("data-disabled", "true");
  });

  test("doesn't call onValueChange when disabled", async () => {
    const handleValueChange = vi.fn();
    const user = userEvent.setup();

    render(<Slider disabled value={[30]} onValueChange={handleValueChange} />);

    const sliderRoot = screen.getByTestId("slider-root");
    await user.click(sliderRoot);

    expect(handleValueChange).not.toHaveBeenCalled();
  });
});
