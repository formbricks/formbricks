import * as SeparatorPrimitive from "@radix-ui/react-separator";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { Separator } from ".";

// Mock Radix UI Separator component
vi.mock("@radix-ui/react-separator", () => {
  const Root = vi.fn(({ className, orientation, decorative, ...props }) => (
    <div
      data-testid="separator-root"
      className={className}
      data-orientation={orientation}
      data-decorative={decorative}
      {...props}
    />
  )) as any;
  Root.displayName = "SeparatorRoot";

  return {
    Root,
  };
});

describe("Separator Component", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders correctly with default props", () => {
    render(<Separator />);

    const separator = screen.getByTestId("separator-root");
    expect(separator).toBeInTheDocument();
    expect(separator).toHaveAttribute("data-orientation", "horizontal");
    expect(separator).toHaveAttribute("data-decorative", "true");
  });

  test("applies correct default classes for horizontal orientation", () => {
    render(<Separator />);

    const separator = screen.getByTestId("separator-root");
    expect(separator).toHaveClass("bg-border");
    expect(separator).toHaveClass("shrink-0");
    expect(separator).toHaveClass("h-[1px]");
    expect(separator).toHaveClass("w-full");
  });

  test("applies correct classes for vertical orientation", () => {
    render(<Separator orientation="vertical" />);

    const separator = screen.getByTestId("separator-root");
    expect(separator).toHaveAttribute("data-orientation", "vertical");
    expect(separator).toHaveClass("bg-border");
    expect(separator).toHaveClass("shrink-0");
    expect(separator).toHaveClass("h-full");
    expect(separator).toHaveClass("w-[1px]");
  });

  test("handles custom className correctly", () => {
    render(<Separator className="custom-separator" />);

    const separator = screen.getByTestId("separator-root");
    expect(separator).toHaveClass("custom-separator");
    expect(separator).toHaveClass("bg-border");
    expect(separator).toHaveClass("shrink-0");
  });

  test("forwards decorative prop correctly", () => {
    const { rerender } = render(<Separator decorative={false} />);

    let separator = screen.getByTestId("separator-root");
    expect(separator).toHaveAttribute("data-decorative", "false");

    rerender(<Separator decorative={true} />);
    separator = screen.getByTestId("separator-root");
    expect(separator).toHaveAttribute("data-decorative", "true");
  });

  test("uses default decorative value when not provided", () => {
    render(<Separator />);

    const separator = screen.getByTestId("separator-root");
    expect(separator).toHaveAttribute("data-decorative", "true");
  });

  test("uses default orientation value when not provided", () => {
    render(<Separator />);

    const separator = screen.getByTestId("separator-root");
    expect(separator).toHaveAttribute("data-orientation", "horizontal");
  });

  test("forwards additional props correctly", () => {
    render(<Separator data-testid="custom-separator" aria-label="Custom separator" role="separator" />);

    const separator = screen.getByTestId("custom-separator");
    expect(separator).toHaveAttribute("data-testid", "custom-separator");
    expect(separator).toHaveAttribute("aria-label", "Custom separator");
    expect(separator).toHaveAttribute("role", "separator");
  });

  test("ref forwarding works correctly", () => {
    const ref = vi.fn();
    render(<Separator ref={ref} />);

    expect(ref).toHaveBeenCalled();
  });

  test("combines orientation and custom className correctly", () => {
    const { rerender } = render(<Separator orientation="horizontal" className="my-separator" />);

    let separator = screen.getByTestId("separator-root");
    expect(separator).toHaveClass("my-separator");
    expect(separator).toHaveClass("h-[1px]");
    expect(separator).toHaveClass("w-full");

    rerender(<Separator orientation="vertical" className="my-separator" />);
    separator = screen.getByTestId("separator-root");
    expect(separator).toHaveClass("my-separator");
    expect(separator).toHaveClass("h-full");
    expect(separator).toHaveClass("w-[1px]");
  });

  test("applies all base classes regardless of orientation", () => {
    const { rerender } = render(<Separator orientation="horizontal" />);

    let separator = screen.getByTestId("separator-root");
    expect(separator).toHaveClass("bg-border");
    expect(separator).toHaveClass("shrink-0");

    rerender(<Separator orientation="vertical" />);
    separator = screen.getByTestId("separator-root");
    expect(separator).toHaveClass("bg-border");
    expect(separator).toHaveClass("shrink-0");
  });

  test("handles undefined className gracefully", () => {
    render(<Separator className={undefined} />);

    const separator = screen.getByTestId("separator-root");
    expect(separator).toBeInTheDocument();
    expect(separator).toHaveClass("bg-border");
    expect(separator).toHaveClass("shrink-0");
  });

  test("handles empty className gracefully", () => {
    render(<Separator className="" />);

    const separator = screen.getByTestId("separator-root");
    expect(separator).toBeInTheDocument();
    expect(separator).toHaveClass("bg-border");
    expect(separator).toHaveClass("shrink-0");
  });

  test("handles multiple custom classes", () => {
    render(<Separator className="class1 class2 class3" />);

    const separator = screen.getByTestId("separator-root");
    expect(separator).toHaveClass("class1");
    expect(separator).toHaveClass("class2");
    expect(separator).toHaveClass("class3");
    expect(separator).toHaveClass("bg-border");
    expect(separator).toHaveClass("shrink-0");
  });

  test("export is available", () => {
    expect(Separator).toBeDefined();
    expect(typeof Separator).toBe("object"); // forwardRef returns an object
  });

  test("component has correct displayName", () => {
    expect(Separator.displayName).toBe(SeparatorPrimitive.Root.displayName);
  });

  test("renders with all props combined", () => {
    render(
      <Separator
        orientation="vertical"
        decorative={false}
        className="custom-class"
        data-testid="full-separator"
        aria-label="Vertical separator"
      />
    );

    const separator = screen.getByTestId("full-separator");
    expect(separator).toBeInTheDocument();
    expect(separator).toHaveAttribute("data-orientation", "vertical");
    expect(separator).toHaveAttribute("data-decorative", "false");
    expect(separator).toHaveAttribute("data-testid", "full-separator");
    expect(separator).toHaveAttribute("aria-label", "Vertical separator");
    expect(separator).toHaveClass("custom-class");
    expect(separator).toHaveClass("bg-border");
    expect(separator).toHaveClass("shrink-0");
    expect(separator).toHaveClass("h-full");
    expect(separator).toHaveClass("w-[1px]");
  });

  test("orientation prop type checking - accepts valid values", () => {
    const { rerender } = render(<Separator orientation="horizontal" />);
    let separator = screen.getByTestId("separator-root");
    expect(separator).toHaveAttribute("data-orientation", "horizontal");

    rerender(<Separator orientation="vertical" />);
    separator = screen.getByTestId("separator-root");
    expect(separator).toHaveAttribute("data-orientation", "vertical");
  });

  test("decorative prop type checking - accepts boolean values", () => {
    const { rerender } = render(<Separator decorative={true} />);
    let separator = screen.getByTestId("separator-root");
    expect(separator).toHaveAttribute("data-decorative", "true");

    rerender(<Separator decorative={false} />);
    separator = screen.getByTestId("separator-root");
    expect(separator).toHaveAttribute("data-decorative", "false");
  });
});
