import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { StylingTabs } from "./index";

describe("StylingTabs", () => {
  afterEach(() => {
    cleanup();
  });

  const mockOptions = [
    { value: "option1", label: "Option 1" },
    { value: "option2", label: "Option 2" },
    { value: "option3", label: "Option 3" },
  ];

  test("renders with all options", () => {
    render(<StylingTabs id="test-tabs" options={mockOptions} onChange={() => {}} />);

    expect(screen.getByText("Option 1")).toBeInTheDocument();
    expect(screen.getByText("Option 2")).toBeInTheDocument();
    expect(screen.getByText("Option 3")).toBeInTheDocument();
  });

  test("selects default option when provided", () => {
    render(
      <StylingTabs id="test-tabs" options={mockOptions} defaultSelected="option2" onChange={() => {}} />
    );

    const option2Input = screen.getByLabelText("Option 2");
    expect(option2Input).toBeChecked();
  });

  test("calls onChange handler when option is selected", async () => {
    const handleChange = vi.fn();
    const user = userEvent.setup();

    render(<StylingTabs id="test-tabs" options={mockOptions} onChange={handleChange} />);

    await user.click(screen.getByText("Option 3"));

    expect(handleChange).toHaveBeenCalledWith("option3");
  });

  test("renders with label and subLabel", () => {
    render(
      <StylingTabs
        id="test-tabs"
        options={mockOptions}
        onChange={() => {}}
        label="Test Label"
        subLabel="Test Sublabel"
      />
    );

    expect(screen.getByText("Test Label")).toBeInTheDocument();
    expect(screen.getByText("Test Sublabel")).toBeInTheDocument();
  });

  test("renders with custom className", () => {
    const { container } = render(
      <StylingTabs id="test-tabs" options={mockOptions} onChange={() => {}} className="custom-class" />
    );

    const radioGroup = container.querySelector('[role="radiogroup"]');
    expect(radioGroup).toHaveClass("custom-class");
  });

  test("renders with custom tabsContainerClassName", () => {
    const { container } = render(
      <StylingTabs
        id="test-tabs"
        options={mockOptions}
        onChange={() => {}}
        tabsContainerClassName="custom-tabs-class"
      />
    );

    const tabsContainer = container.querySelector(".overflow-hidden.rounded-md.border");
    expect(tabsContainer).toHaveClass("custom-tabs-class");
  });

  test("renders options with icons when provided", () => {
    const optionsWithIcons = [
      { value: "option1", label: "Option 1", icon: <span data-testid="icon1">Icon 1</span> },
      { value: "option2", label: "Option 2", icon: <span data-testid="icon2">Icon 2</span> },
    ];

    render(<StylingTabs id="test-tabs" options={optionsWithIcons} onChange={() => {}} />);

    expect(screen.getByTestId("icon1")).toBeInTheDocument();
    expect(screen.getByTestId("icon2")).toBeInTheDocument();
  });

  test("applies selected styling to active option", async () => {
    const user = userEvent.setup();

    render(<StylingTabs id="test-tabs" options={mockOptions} onChange={() => {}} />);

    const option1Label = screen.getByText("Option 1").closest("label");
    const option2Label = screen.getByText("Option 2").closest("label");

    await user.click(screen.getByText("Option 2"));

    expect(option1Label).not.toHaveClass("bg-slate-100");
    expect(option2Label).toHaveClass("bg-slate-100");
  });
});
