import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import { Badge } from "./index";

describe("Badge", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders with text", () => {
    render(<Badge text="Test Badge" type="warning" size="normal" />);
    expect(screen.getByText("Test Badge")).toBeInTheDocument();
  });

  test("renders with correct type classes", () => {
    const { rerender } = render(<Badge text="Warning" type="warning" size="normal" />);
    expect(screen.getByText("Warning")).toHaveClass("bg-amber-100");
    expect(screen.getByText("Warning")).toHaveClass("border-amber-200");
    expect(screen.getByText("Warning")).toHaveClass("text-amber-800");

    rerender(<Badge text="Success" type="success" size="normal" />);
    expect(screen.getByText("Success")).toHaveClass("bg-green-50");
    expect(screen.getByText("Success")).toHaveClass("border-green-600");
    expect(screen.getByText("Success")).toHaveClass("text-green-800");

    rerender(<Badge text="Error" type="error" size="normal" />);
    expect(screen.getByText("Error")).toHaveClass("bg-red-100");
    expect(screen.getByText("Error")).toHaveClass("border-red-200");
    expect(screen.getByText("Error")).toHaveClass("text-red-800");

    rerender(<Badge text="Gray" type="gray" size="normal" />);
    expect(screen.getByText("Gray")).toHaveClass("bg-slate-100");
    expect(screen.getByText("Gray")).toHaveClass("border-slate-200");
    expect(screen.getByText("Gray")).toHaveClass("text-slate-600");
  });

  test("renders with correct size classes", () => {
    const { rerender } = render(<Badge text="Tiny" type="warning" size="tiny" />);
    expect(screen.getByText("Tiny")).toHaveClass("px-1.5");
    expect(screen.getByText("Tiny")).toHaveClass("py-0.5");
    expect(screen.getByText("Tiny")).toHaveClass("text-xs");

    rerender(<Badge text="Normal" type="warning" size="normal" />);
    expect(screen.getByText("Normal")).toHaveClass("px-2.5");
    expect(screen.getByText("Normal")).toHaveClass("py-0.5");
    expect(screen.getByText("Normal")).toHaveClass("text-xs");

    rerender(<Badge text="Large" type="warning" size="large" />);
    expect(screen.getByText("Large")).toHaveClass("px-3.5");
    expect(screen.getByText("Large")).toHaveClass("py-1");
    expect(screen.getByText("Large")).toHaveClass("text-sm");
  });

  test("applies custom className when provided", () => {
    render(<Badge text="Custom Class" type="warning" size="normal" className="custom-class" />);
    expect(screen.getByText("Custom Class")).toHaveClass("custom-class");
  });

  test("applies the provided role attribute", () => {
    render(<Badge text="Role Test" type="warning" size="normal" role="status" />);
    expect(screen.getByRole("status")).toHaveTextContent("Role Test");
  });

  test("combines all classes correctly", () => {
    render(<Badge text="Combined" type="success" size="large" className="custom-class" />);
    const badge = screen.getByText("Combined");
    expect(badge).toHaveClass("bg-green-50");
    expect(badge).toHaveClass("border-green-600");
    expect(badge).toHaveClass("text-green-800");
    expect(badge).toHaveClass("px-3.5");
    expect(badge).toHaveClass("py-1");
    expect(badge).toHaveClass("text-sm");
    expect(badge).toHaveClass("custom-class");
  });
});
