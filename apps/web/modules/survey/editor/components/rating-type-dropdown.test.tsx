import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HashIcon } from "lucide-react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { Dropdown } from "./rating-type-dropdown";

describe("Dropdown", () => {
  afterEach(() => {
    cleanup();
  });

  test("should initialize with the correct default option when defaultValue matches an option's value", () => {
    const options = [
      { label: "Option 1", value: "option1" },
      { label: "Option 2", value: "option2" },
      { label: "Option 3", value: "option3" },
    ];
    const defaultValue = "option2";
    const onSelect = vi.fn();

    render(<Dropdown options={options} defaultValue={defaultValue} onSelect={onSelect} />);

    // Assert that the displayed label matches the expected default option's label.
    expect(screen.getByText("Option 2")).toBeInTheDocument();
  });

  test("should update the selected option when a new option is clicked", async () => {
    const options = [
      { label: "Option 1", value: "option1" },
      { label: "Option 2", value: "option2" },
      { label: "Option 3", value: "option3" },
    ];
    const defaultValue = "option1";
    const onSelect = vi.fn();

    render(<Dropdown options={options} defaultValue={defaultValue} onSelect={onSelect} />);

    // Open the dropdown.  We don't have a specific test id, so we'll grab the button by its text content.
    await userEvent.click(screen.getByText("Option 1"));

    // Click on "Option 2"
    await userEvent.click(screen.getByText("Option 2"));

    // Assert that the displayed label has been updated to "Option 2".
    expect(screen.getByText("Option 2")).toBeInTheDocument();
  });

  test("should call onSelect with the correct option when an option is selected", async () => {
    const options = [
      { label: "Option A", value: "a" },
      { label: "Option B", value: "b" },
      { label: "Option C", value: "c" },
    ];
    const defaultValue = "a";
    const onSelect = vi.fn();

    render(<Dropdown options={options} defaultValue={defaultValue} onSelect={onSelect} />);

    // Open the dropdown by clicking the trigger button (the currently selected option).
    await userEvent.click(screen.getByText("Option A"));

    // Select "Option B"
    await userEvent.click(screen.getByText("Option B"));

    // Assert that onSelect is called with the correct option
    expect(onSelect).toHaveBeenCalledWith(options[1]);
  });

  test("should display the correct label and icon for the selected option", () => {
    const options = [
      { label: "Number", value: "number", icon: HashIcon },
      { label: "Star", value: "star" },
    ];
    const defaultValue = "number";
    const onSelect = vi.fn();

    render(<Dropdown options={options} defaultValue={defaultValue} onSelect={onSelect} />);

    // Assert that the displayed label matches the expected default option's label.
    expect(screen.getByText("Number")).toBeInTheDocument();

    // Assert that the icon is present
    expect(screen.getByText("Number").previousSibling).toHaveClass("lucide-hash");
  });

  test("should disable all options when the disabled prop is true", async () => {
    const options = [
      { label: "Option 1", value: "option1" },
      { label: "Option 2", value: "option2" },
    ];
    const defaultValue = "option1";
    const onSelect = vi.fn();

    render(<Dropdown options={options} defaultValue={defaultValue} disabled={true} onSelect={onSelect} />);

    // Open the dropdown
    const button = screen.getByRole("button");
    await userEvent.click(button);

    const menuItems = screen.getAllByRole("menuitem");
    const option1MenuItem = menuItems.find((item) => item.textContent === "Option 1");
    const option2MenuItem = menuItems.find((item) => item.textContent === "Option 2");

    expect(option1MenuItem).toHaveAttribute("data-disabled", "");
    expect(option2MenuItem).toHaveAttribute("data-disabled", "");
  });

  test("should disable individual options when the option's disabled property is true", async () => {
    const options = [
      { label: "Option 1", value: "option1", disabled: true },
      { label: "Option 2", value: "option2" },
    ];
    const defaultValue = "option2";
    const onSelect = vi.fn();

    render(<Dropdown options={options} defaultValue={defaultValue} onSelect={onSelect} />);

    // Open the dropdown
    const button = screen.getByRole("button");
    await userEvent.click(button);

    const menuItems = screen.getAllByRole("menuitem");
    const option1MenuItem = menuItems.find((item) => item.textContent === "Option 1");
    const option2MenuItem = menuItems.find((item) => item.textContent === "Option 2");

    expect(option1MenuItem).toHaveAttribute("data-disabled", "");
    expect(option2MenuItem).not.toHaveAttribute("data-disabled", "");
  });

  test("should fall back to the first option when defaultValue does not match any option", () => {
    const options = [
      { label: "Option 1", value: "option1" },
      { label: "Option 2", value: "option2" },
      { label: "Option 3", value: "option3" },
    ];
    const defaultValue = "nonexistent";
    const onSelect = vi.fn();

    render(<Dropdown options={options} defaultValue={defaultValue} onSelect={onSelect} />);

    // Assert that the displayed label matches the first option's label.
    expect(screen.getByText("Option 1")).toBeInTheDocument();
  });

  test("should handle dynamic updates to options prop and maintain a valid selection", () => {
    const initialOptions = [
      { label: "Option A", value: "a" },
      { label: "Option B", value: "b" },
    ];
    const defaultValue = "a";
    const onSelect = vi.fn();

    const { rerender } = render(
      <Dropdown options={initialOptions} defaultValue={defaultValue} onSelect={onSelect} />
    );

    expect(screen.getByText("Option A")).toBeInTheDocument();

    const updatedOptions = [
      { label: "Option C", value: "c" },
      { label: "Option A", value: "a" },
    ];

    rerender(<Dropdown options={updatedOptions} defaultValue={defaultValue} onSelect={onSelect} />);

    expect(screen.getByText("Option A")).toBeInTheDocument();
  });
});
