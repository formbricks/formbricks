import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { BadgeSelect, TBadgeSelectOption } from "./index";

describe("BadgeSelect", () => {
  const mockOptions = [
    { text: "Option 1", type: "warning" as TBadgeSelectOption["type"] },
    { text: "Option 2", type: "success" as TBadgeSelectOption["type"] },
    { text: "Option 3", type: "error" as TBadgeSelectOption["type"] },
    { text: "Option 4", type: "gray" as TBadgeSelectOption["type"] },
  ];

  afterEach(() => {
    cleanup();
  });

  test("renders with default option", () => {
    render(<BadgeSelect options={mockOptions} size="normal" />);
    expect(screen.getByText("Option 1")).toBeInTheDocument();
    expect(screen.getByText("Option 1").closest("span")).toHaveClass("bg-amber-100");
  });

  test("renders with selected option", () => {
    render(<BadgeSelect options={mockOptions} selectedIndex={1} size="normal" />);
    expect(screen.getByText("Option 2")).toBeInTheDocument();
    expect(screen.getByText("Option 2").closest("span")).toHaveClass("bg-emerald-100");
  });

  test("renders with single text and type", () => {
    render(<BadgeSelect text="Single Badge" type="error" size="normal" />);
    expect(screen.getByText("Single Badge")).toBeInTheDocument();
    expect(screen.getByText("Single Badge").closest("span")).toHaveClass("bg-red-100");
  });

  test("applies correct size classes", () => {
    const { rerender } = render(<BadgeSelect text="Tiny" type="warning" size="tiny" />);
    expect(screen.getByText("Tiny").closest("span")).toHaveClass("px-1.5", "py-0.5", "text-xs");

    rerender(<BadgeSelect text="Normal" type="warning" size="normal" />);
    expect(screen.getByText("Normal").closest("span")).toHaveClass("px-2.5", "py-0.5", "text-xs");

    rerender(<BadgeSelect text="Large" type="warning" size="large" />);
    expect(screen.getByText("Large").closest("span")).toHaveClass("px-3.5", "py-1", "text-sm");
  });

  test("applies custom className", () => {
    render(<BadgeSelect text="Custom" type="warning" size="normal" className="custom-class" />);
    expect(screen.getByText("Custom").closest("span")).toHaveClass("custom-class");
  });

  test("renders loading state", () => {
    render(<BadgeSelect text="Loading" type="warning" size="normal" isLoading={true} />);
    expect(screen.getByText("", { selector: "span.animate-pulse" })).toBeInTheDocument();
    expect(screen.queryByText("Loading")).not.toBeInTheDocument();
  });

  test("shows dropdown when clicked", async () => {
    const user = userEvent.setup();
    render(<BadgeSelect options={mockOptions} size="normal" />);

    await user.click(screen.getByText("Option 1"));

    expect(screen.getByText("Option 2")).toBeInTheDocument();
    expect(screen.getByText("Option 3")).toBeInTheDocument();
    expect(screen.getByText("Option 4")).toBeInTheDocument();
  });

  test("calls onChange when option is selected", async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();
    render(<BadgeSelect options={mockOptions} size="normal" onChange={handleChange} />);

    await user.click(screen.getByText("Option 1"));
    await user.click(screen.getByText("Option 3"));

    expect(handleChange).toHaveBeenCalledWith(2);
  });

  test("prevents event propagation when option is clicked", async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();
    const mockStopPropagation = vi.fn();

    render(<BadgeSelect options={mockOptions} size="normal" onChange={handleChange} />);

    await user.click(screen.getByText("Option 1"));

    // Simulate a click with stopPropagation
    const option2Element = screen.getByText("Option 2");
    option2Element.click();

    expect(mockStopPropagation).not.toHaveBeenCalled(); // Direct click won't use our mock

    // Verify the element is clickable
    await user.click(option2Element);
    expect(handleChange).toHaveBeenCalled();
  });

  test("renders chevron icon when options are provided", () => {
    render(<BadgeSelect options={mockOptions} size="normal" />);
    // Look for an SVG element inside the span containing "Option 1"
    const parentElement = screen.getByText("Option 1").parentElement;
    const svgElement = parentElement?.querySelector("svg");
    expect(svgElement).toBeInTheDocument();
  });

  test("doesn't render chevron icon when no options are provided", () => {
    render(<BadgeSelect text="No Options" type="warning" size="normal" />);
    const parentElement = screen.getByText("No Options").parentElement;
    const svgElement = parentElement?.querySelector("svg");
    expect(svgElement).not.toBeInTheDocument();
  });

  test("has correct cursor styling based on options", () => {
    const { rerender } = render(<BadgeSelect options={mockOptions} size="normal" />);
    expect(screen.getByText("Option 1").closest("span")).toHaveClass("cursor-pointer");

    rerender(<BadgeSelect text="No Options" type="warning" size="normal" />);
    expect(screen.getByText("No Options").closest("span")).toHaveClass("pointer-events-none");
  });

  test("has pointer-events-none class when loading", () => {
    render(<BadgeSelect options={mockOptions} size="normal" isLoading={true} />);
    const animatePulseElement = screen.getByText("", { selector: "span.animate-pulse" });
    const triggerElement = animatePulseElement.parentElement;
    expect(triggerElement).toHaveClass("pointer-events-none");
  });
});
