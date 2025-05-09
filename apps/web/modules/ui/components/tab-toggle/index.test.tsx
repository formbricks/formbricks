import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { TabToggle } from "./index";

describe("TabToggle", () => {
  afterEach(() => {
    cleanup();
  });

  const mockOptions = [
    { value: "option1", label: "Option 1" },
    { value: "option2", label: "Option 2" },
    { value: "option3", label: "Option 3" },
  ];

  test("renders all options correctly", () => {
    render(<TabToggle id="test" options={mockOptions} onChange={() => {}} />);

    expect(screen.getByLabelText("Option 1")).toBeInTheDocument();
    expect(screen.getByLabelText("Option 2")).toBeInTheDocument();
    expect(screen.getByLabelText("Option 3")).toBeInTheDocument();
  });

  test("selects default option when provided", () => {
    render(<TabToggle id="test" options={mockOptions} defaultSelected="option2" onChange={() => {}} />);

    const option1Radio = screen.getByLabelText("Option 1") as HTMLInputElement;
    const option2Radio = screen.getByLabelText("Option 2") as HTMLInputElement;
    const option3Radio = screen.getByLabelText("Option 3") as HTMLInputElement;

    expect(option1Radio.checked).toBe(false);
    expect(option2Radio.checked).toBe(true);
    expect(option3Radio.checked).toBe(false);
  });

  test("calls onChange handler when option is selected", async () => {
    const handleChange = vi.fn();
    const user = userEvent.setup();

    render(<TabToggle id="test" options={mockOptions} onChange={handleChange} />);

    await user.click(screen.getByLabelText("Option 2"));

    expect(handleChange).toHaveBeenCalledTimes(1);
    expect(handleChange).toHaveBeenCalledWith("option2");
  });

  test("displays option labels correctly", () => {
    render(<TabToggle id="test" options={mockOptions} onChange={() => {}} />);

    expect(screen.getByText("Option 1")).toBeInTheDocument();
    expect(screen.getByText("Option 2")).toBeInTheDocument();
    expect(screen.getByText("Option 3")).toBeInTheDocument();
  });

  test("applies correct styling to selected option", async () => {
    const user = userEvent.setup();

    render(<TabToggle id="test" options={mockOptions} onChange={() => {}} />);

    const option2Label = screen.getByText("Option 2").closest("label");
    expect(option2Label).not.toHaveClass("bg-white");

    await user.click(screen.getByLabelText("Option 2"));

    expect(option2Label).toHaveClass("bg-white");
  });

  test("renders in disabled state", () => {
    render(<TabToggle id="test" options={mockOptions} onChange={() => {}} disabled={true} />);

    const option1Radio = screen.getByLabelText("Option 1") as HTMLInputElement;
    const option2Radio = screen.getByLabelText("Option 2") as HTMLInputElement;
    const option3Radio = screen.getByLabelText("Option 3") as HTMLInputElement;

    expect(option1Radio).toBeDisabled();
    expect(option2Radio).toBeDisabled();
    expect(option3Radio).toBeDisabled();

    const labels = screen.getAllByRole("radio").map((radio) => radio.closest("label"));
    labels.forEach((label) => {
      expect(label).toHaveClass("cursor-not-allowed");
      expect(label).toHaveClass("opacity-50");
    });
  });

  test("doesn't call onChange when disabled", async () => {
    const handleChange = vi.fn();
    const user = userEvent.setup();

    render(<TabToggle id="test" options={mockOptions} onChange={handleChange} disabled={true} />);

    await user.click(screen.getByLabelText("Option 2"));

    expect(handleChange).not.toHaveBeenCalled();
  });

  test("renders with number values", () => {
    const numberOptions = [
      { value: 1, label: "One" },
      { value: 2, label: "Two" },
    ];

    render(<TabToggle id="test" options={numberOptions} defaultSelected={1} onChange={() => {}} />);

    const option1Radio = screen.getByLabelText("One") as HTMLInputElement;
    const option2Radio = screen.getByLabelText("Two") as HTMLInputElement;

    expect(option1Radio.checked).toBe(true);
    expect(option2Radio.checked).toBe(false);
  });

  test("sets correct aria attributes", () => {
    render(<TabToggle id="test-id" options={mockOptions} onChange={() => {}} />);

    const radioGroup = screen.getByRole("radiogroup");
    expect(radioGroup).toHaveAttribute("aria-labelledby", "test-id-toggle-label");
  });
});
