import "@testing-library/jest-dom/vitest";
import { render } from "@testing-library/preact";
import { describe, expect, test } from "vitest";
import { Input } from "./input";

describe("Input", () => {
  test("renders with default attributes", () => {
    const { container } = render(<Input />);
    const input = container.querySelector("input");

    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute("dir", "auto");
  });

  test("applies base classes", () => {
    const { container } = render(<Input />);
    const input = container.querySelector("input");

    expect(input).toHaveClass(
      "fb-bg-input-bg",
      "fb-flex",
      "fb-w-full",
      "fb-border",
      "fb-border-border",
      "fb-rounded-custom",
      "fb-px-3",
      "fb-py-2",
      "fb-text-sm",
      "fb-text-subheading"
    );
  });

  test("applies custom className", () => {
    const { container } = render(<Input className="custom-class" />);
    const input = container.querySelector("input");

    expect(input).toHaveClass("custom-class");
  });

  test("forwards HTML input attributes", () => {
    const { container } = render(<Input type="email" placeholder="test@example.com" disabled />);
    const input = container.querySelector("input");

    expect(input).toHaveAttribute("type", "email");
    expect(input).toHaveAttribute("placeholder", "test@example.com");
    expect(input).toBeDisabled();
  });
});
