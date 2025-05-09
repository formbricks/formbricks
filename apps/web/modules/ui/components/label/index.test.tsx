import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { Label } from "./index";

// Mock Radix UI Label primitive
vi.mock("@radix-ui/react-label", () => ({
  Root: ({ children, className, htmlFor, ...props }: any) => (
    <label className={className} htmlFor={htmlFor} data-testid="radix-label" {...props}>
      {children}
    </label>
  ),
}));

describe("Label", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders with default styling", () => {
    render(<Label>Test Label</Label>);

    const label = screen.getByTestId("radix-label");
    expect(label).toBeInTheDocument();
    expect(label).toHaveTextContent("Test Label");
    expect(label).toHaveClass("text-sm", "leading-none", "font-medium", "text-slate-800");
  });

  test("applies additional className when provided", () => {
    render(<Label className="custom-class">Test Label</Label>);

    const label = screen.getByTestId("radix-label");
    expect(label).toHaveClass("custom-class");
    expect(label).toHaveClass("text-sm", "leading-none", "font-medium", "text-slate-800");
  });

  test("forwards ref to underlying label element", () => {
    const ref = React.createRef<HTMLLabelElement>();
    render(<Label ref={ref}>Test Label</Label>);

    expect(ref.current).not.toBeNull();
    expect(ref.current).toBe(screen.getByTestId("radix-label"));
  });

  test("passes additional props to underlying label element", () => {
    render(
      <Label data-custom="test-data" id="test-id">
        Test Label
      </Label>
    );

    const label = screen.getByTestId("radix-label");
    expect(label).toHaveAttribute("data-custom", "test-data");
    expect(label).toHaveAttribute("id", "test-id");
  });
});
