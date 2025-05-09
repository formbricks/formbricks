import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as React from "react";
import { afterEach, describe, expect, test } from "vitest";
import { Input } from "./index";

describe("Input", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders with default props", () => {
    render(<Input data-testid="test-input" />);
    const input = screen.getByTestId("test-input");
    expect(input).toBeInTheDocument();
    expect(input).toHaveClass("flex h-10 w-full rounded-md border border-slate-300");
  });

  test("applies additional className when provided", () => {
    render(<Input data-testid="test-input" className="test-class" />);
    const input = screen.getByTestId("test-input");
    expect(input).toHaveClass("test-class");
  });

  test("renders with invalid styling when isInvalid is true", () => {
    render(<Input data-testid="test-input" isInvalid={true} />);
    const input = screen.getByTestId("test-input");
    expect(input).toHaveClass("border-red-500");
  });

  test("forwards ref to input element", () => {
    const inputRef = React.createRef<HTMLInputElement>();
    render(<Input ref={inputRef} data-testid="test-input" />);
    expect(inputRef.current).not.toBeNull();
    expect(inputRef.current).toBe(screen.getByTestId("test-input"));
  });

  test("applies disabled styles when disabled prop is provided", () => {
    render(<Input data-testid="test-input" disabled />);
    const input = screen.getByTestId("test-input");
    expect(input).toBeDisabled();
    expect(input).toHaveClass("disabled:cursor-not-allowed disabled:opacity-50");
  });

  test("handles user input correctly", async () => {
    const user = userEvent.setup();
    render(<Input data-testid="test-input" />);
    const input = screen.getByTestId("test-input");

    await user.type(input, "hello");
    expect(input).toHaveValue("hello");
  });

  test("handles value prop correctly", () => {
    render(<Input data-testid="test-input" value="test-value" readOnly />);
    const input = screen.getByTestId("test-input");
    expect(input).toHaveValue("test-value");
  });

  test("handles placeholder prop correctly", () => {
    render(<Input data-testid="test-input" placeholder="test-placeholder" />);
    const input = screen.getByTestId("test-input");
    expect(input).toHaveAttribute("placeholder", "test-placeholder");
  });

  test("passes HTML attributes to the input element", () => {
    render(
      <Input
        data-testid="test-input"
        type="password"
        name="password"
        maxLength={10}
        aria-label="Password input"
      />
    );
    const input = screen.getByTestId("test-input");
    expect(input).toHaveAttribute("type", "password");
    expect(input).toHaveAttribute("name", "password");
    expect(input).toHaveAttribute("maxLength", "10");
    expect(input).toHaveAttribute("aria-label", "Password input");
  });

  test("applies focus styles on focus", async () => {
    const user = userEvent.setup();
    render(<Input data-testid="test-input" />);
    const input = screen.getByTestId("test-input");

    expect(input).not.toHaveFocus();
    await user.click(input);
    expect(input).toHaveFocus();
  });
});
