import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { RadioGroup, RadioGroupItem } from "./index";

describe("RadioGroup", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders radio group with items", () => {
    render(
      <RadioGroup defaultValue="option1">
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="option1" id="option1" />
          <label htmlFor="option1">Option 1</label>
        </div>
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="option2" id="option2" />
          <label htmlFor="option2">Option 2</label>
        </div>
      </RadioGroup>
    );

    expect(screen.getByText("Option 1")).toBeInTheDocument();
    expect(screen.getByText("Option 2")).toBeInTheDocument();
    expect(screen.getByLabelText("Option 1")).toBeInTheDocument();
    expect(screen.getByLabelText("Option 2")).toBeInTheDocument();
  });

  test("selects default value", () => {
    render(
      <RadioGroup defaultValue="option1">
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="option1" id="option1" />
          <label htmlFor="option1">Option 1</label>
        </div>
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="option2" id="option2" />
          <label htmlFor="option2">Option 2</label>
        </div>
      </RadioGroup>
    );

    const option1 = screen.getByLabelText("Option 1");
    const option2 = screen.getByLabelText("Option 2");

    expect(option1).toBeChecked();
    expect(option2).not.toBeChecked();
  });

  test("changes selection when clicking on a different option", async () => {
    const user = userEvent.setup();
    const handleValueChange = vi.fn();

    render(
      <RadioGroup defaultValue="option1" onValueChange={handleValueChange}>
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="option1" id="option1" />
          <label htmlFor="option1">Option 1</label>
        </div>
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="option2" id="option2" />
          <label htmlFor="option2">Option 2</label>
        </div>
      </RadioGroup>
    );

    const option2 = screen.getByLabelText("Option 2");
    await user.click(option2);

    expect(handleValueChange).toHaveBeenCalledWith("option2");
  });

  test("renders disabled radio items", async () => {
    const user = userEvent.setup();
    const handleValueChange = vi.fn();

    render(
      <RadioGroup defaultValue="option1" onValueChange={handleValueChange}>
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="option1" id="option1" />
          <label htmlFor="option1">Option 1</label>
        </div>
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="option2" id="option2" disabled />
          <label htmlFor="option2">Option 2 (Disabled)</label>
        </div>
      </RadioGroup>
    );

    const option2 = screen.getByLabelText("Option 2 (Disabled)");
    expect(option2).toBeDisabled();

    await user.click(option2);
    expect(handleValueChange).not.toHaveBeenCalled();
  });

  test("applies custom className to RadioGroup", () => {
    render(
      <RadioGroup defaultValue="option1" className="custom-class">
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="option1" id="option1" />
          <label htmlFor="option1">Option 1</label>
        </div>
      </RadioGroup>
    );

    const radioGroup = screen.getByRole("radiogroup");
    expect(radioGroup).toHaveClass("custom-class");
    expect(radioGroup).toHaveClass("grid");
    expect(radioGroup).toHaveClass("gap-x-3");
  });

  test("applies custom className to RadioGroupItem", () => {
    render(
      <RadioGroup defaultValue="option1">
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="option1" id="option1" className="custom-item-class" />
          <label htmlFor="option1">Option 1</label>
        </div>
      </RadioGroup>
    );

    const radioItem = screen.getByLabelText("Option 1");
    expect(radioItem).toHaveClass("custom-item-class");
    expect(radioItem).toHaveClass("h-4");
    expect(radioItem).toHaveClass("w-4");
    expect(radioItem).toHaveClass("rounded-full");
    expect(radioItem).toHaveClass("border");
    expect(radioItem).toHaveClass("border-slate-300");
  });
});
