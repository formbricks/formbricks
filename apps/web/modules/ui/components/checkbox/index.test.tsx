import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test } from "vitest";
import { Checkbox } from "./index";

describe("Checkbox", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders correctly with default props", () => {
    render(<Checkbox aria-label="Test checkbox" />);

    const checkbox = screen.getByRole("checkbox", { name: "Test checkbox" });
    expect(checkbox).toBeInTheDocument();
    expect(checkbox).not.toBeChecked();
  });

  test("can be checked and unchecked", async () => {
    const user = userEvent.setup();

    render(<Checkbox aria-label="Test checkbox" />);
    const checkbox = screen.getByRole("checkbox", { name: "Test checkbox" });

    expect(checkbox).not.toBeChecked();

    await user.click(checkbox);
    expect(checkbox).toBeChecked();

    await user.click(checkbox);
    expect(checkbox).not.toBeChecked();
  });

  test("applies custom class name", () => {
    render(<Checkbox aria-label="Test checkbox" className="custom-class" />);

    const checkbox = screen.getByRole("checkbox", { name: "Test checkbox" });
    expect(checkbox).toHaveClass("custom-class");
  });

  test("can be disabled", async () => {
    const user = userEvent.setup();

    render(<Checkbox aria-label="Test checkbox" disabled />);

    const checkbox = screen.getByRole("checkbox", { name: "Test checkbox" });
    expect(checkbox).toBeDisabled();

    await user.click(checkbox);
    expect(checkbox).not.toBeChecked();
  });

  test("displays check icon when checked", async () => {
    const user = userEvent.setup();

    render(<Checkbox aria-label="Test checkbox" />);
    const checkbox = screen.getByRole("checkbox", { name: "Test checkbox" });

    await user.click(checkbox);

    const checkIcon = document.querySelector("svg");
    expect(checkIcon).toBeInTheDocument();
  });
});
