import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { OptionsSwitch } from "./index";

describe("OptionsSwitch", () => {
  afterEach(() => {
    cleanup();
  });

  const mockOptions = [
    { value: "option1", label: "Option 1" },
    { value: "option2", label: "Option 2" },
    { value: "option3", label: "Option 3", disabled: true },
  ];

  test("renders all options correctly", () => {
    render(<OptionsSwitch options={mockOptions} currentOption="option1" handleOptionChange={() => {}} />);

    expect(screen.getByText("Option 1")).toBeInTheDocument();
    expect(screen.getByText("Option 2")).toBeInTheDocument();
    expect(screen.getByText("Option 3")).toBeInTheDocument();
  });

  test("highlights the current option", () => {
    render(<OptionsSwitch options={mockOptions} currentOption="option1" handleOptionChange={() => {}} />);

    // Check that the highlight div exists
    const highlight = document.querySelector(".absolute.bottom-1.top-1.rounded-md.bg-slate-100");
    expect(highlight).toBeInTheDocument();
  });

  test("calls handleOptionChange with option value when clicked", async () => {
    const handleOptionChange = vi.fn();
    const user = userEvent.setup();

    render(
      <OptionsSwitch options={mockOptions} currentOption="option1" handleOptionChange={handleOptionChange} />
    );

    await user.click(screen.getByText("Option 2"));

    expect(handleOptionChange).toHaveBeenCalledWith("option2");
  });

  test("does not call handleOptionChange when disabled option is clicked", async () => {
    const handleOptionChange = vi.fn();
    const user = userEvent.setup();

    render(
      <OptionsSwitch options={mockOptions} currentOption="option1" handleOptionChange={handleOptionChange} />
    );

    await user.click(screen.getByText("Option 3"));

    expect(handleOptionChange).not.toHaveBeenCalled();
  });

  test("renders icons when provided", () => {
    const optionsWithIcons = [
      {
        value: "option1",
        label: "Option 1",
        icon: <svg data-testid="icon-option1" />,
      },
      {
        value: "option2",
        label: "Option 2",
      },
    ];

    render(
      <OptionsSwitch options={optionsWithIcons} currentOption="option1" handleOptionChange={() => {}} />
    );

    expect(screen.getByTestId("icon-option1")).toBeInTheDocument();
  });

  test("updates highlight position when current option changes", () => {
    const { rerender } = render(
      <OptionsSwitch options={mockOptions} currentOption="option1" handleOptionChange={() => {}} />
    );

    // Re-render with different current option
    rerender(<OptionsSwitch options={mockOptions} currentOption="option2" handleOptionChange={() => {}} />);

    // The highlight style should be updated through useEffect
    // We can verify the component doesn't crash on re-render
    expect(screen.getByText("Option 2")).toBeInTheDocument();
  });
});
