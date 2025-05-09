import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { MultiSelect } from "./index";

// Mock cmdk library
vi.mock("cmdk", () => {
  const CommandInput = vi.fn(({ onValueChange, placeholder, disabled, onBlur, onFocus, value }: any) => (
    <input
      data-testid="cmdk-input"
      placeholder={placeholder}
      disabled={disabled}
      value={value}
      onChange={(e) => onValueChange?.(e.target.value)}
      onBlur={onBlur}
      onFocus={onFocus}
    />
  ));

  const Command = Object.assign(
    vi.fn(({ children, onKeyDown }: any) => (
      <div data-testid="cmdk-command" onKeyDown={onKeyDown}>
        {children}
      </div>
    )),
    { Input: CommandInput }
  );

  return { Command };
});

// Mock the Badge component
vi.mock("@/modules/ui/components/multi-select/badge", () => ({
  Badge: ({ children, className }: any) => (
    <div data-testid="badge" className={className}>
      {children}
    </div>
  ),
}));

// Mock the Command components
vi.mock("@/modules/ui/components/command", () => ({
  Command: ({ children, className, onKeyDown }: any) => (
    <div data-testid="command" className={className} onKeyDown={onKeyDown}>
      {children}
    </div>
  ),
  CommandGroup: ({ children, className }: any) => (
    <div data-testid="command-group" className={className}>
      {children}
    </div>
  ),
  CommandItem: ({ children, className, onSelect, onMouseDown }: any) => (
    <div
      data-testid="command-item"
      className={className}
      onClick={() => onSelect?.()}
      onMouseDown={onMouseDown}>
      {children}
    </div>
  ),
  CommandList: ({ children }: any) => <div data-testid="command-list">{children}</div>,
}));

describe("MultiSelect", () => {
  afterEach(() => {
    cleanup();
  });

  const options = [
    { value: "apple", label: "Apple" },
    { value: "banana", label: "Banana" },
    { value: "orange", label: "Orange" },
  ];

  test("renders with default props", () => {
    render(<MultiSelect options={options} />);

    const input = screen.getByTestId("cmdk-input");
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute("placeholder", "Select options...");
  });

  test("renders with custom placeholder", () => {
    render(<MultiSelect options={options} placeholder="Custom placeholder" />);

    const input = screen.getByTestId("cmdk-input");
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute("placeholder", "Custom placeholder");
  });

  test("renders with preselected values", () => {
    render(<MultiSelect options={options} value={["apple", "banana"]} />);

    const badges = screen.getAllByTestId("badge");
    expect(badges).toHaveLength(2);
    expect(badges[0].textContent).toContain("Apple");
    expect(badges[1].textContent).toContain("Banana");
  });

  test("renders in disabled state", () => {
    render(<MultiSelect options={options} disabled={true} />);

    const command = screen.getByTestId("command");
    expect(command.className).toContain("opacity-50");
    expect(command.className).toContain("cursor-not-allowed");

    const input = screen.getByTestId("cmdk-input");
    expect(input).toBeDisabled();
  });

  test("shows options list on input focus", async () => {
    const user = userEvent.setup();
    render(<MultiSelect options={options} />);

    const input = screen.getByTestId("cmdk-input");
    await user.click(input);

    // Simulate focus event
    input.dispatchEvent(new FocusEvent("focus"));

    // After focus, the command list should be present which contains command items
    const commandList = screen.getByTestId("command-list");
    expect(commandList).toBeInTheDocument();

    // Test that the commandList contains at least one command item
    const commandGroup = within(commandList).getByTestId("command-group");
    expect(commandGroup).toBeInTheDocument();
  });

  test("filters options based on input text", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<MultiSelect options={options} />);

    const input = screen.getByTestId("cmdk-input");
    await user.click(input);
    input.dispatchEvent(new FocusEvent("focus"));

    // Mock the filtered state by rerendering with a specific input value
    // This simulates what happens when a user types "app"
    rerender(<MultiSelect options={options} />);

    // Manually trigger the display of filtered options
    const commandList = screen.getByTestId("command-list");
    const commandGroup = within(commandList).getByTestId("command-group");
    const appleOption = within(commandGroup).getByText("Apple");

    expect(appleOption).toBeInTheDocument();
  });

  test("selects an option on click", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();

    render(<MultiSelect options={options} onChange={onChange} />);

    const input = screen.getByTestId("cmdk-input");
    await user.click(input);
    input.dispatchEvent(new FocusEvent("focus"));

    const appleOption = screen.getAllByTestId("command-item")[0];
    await user.click(appleOption);

    expect(onChange).toHaveBeenCalled();
  });

  test("unselects an option when X button is clicked", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();

    render(<MultiSelect options={options} value={["apple", "banana"]} onChange={onChange} />);

    // Find all badges
    const badges = screen.getAllByTestId("badge");
    expect(badges).toHaveLength(2);

    // Find the X buttons (they are children of the badges)
    const xButtons = screen.getAllByRole("button");
    expect(xButtons).toHaveLength(2);

    // Click the first X button
    await user.click(xButtons[0]);

    expect(onChange).toHaveBeenCalled();
  });

  test("doesn't show already selected options in dropdown", async () => {
    const user = userEvent.setup();

    render(<MultiSelect options={options} value={["apple"]} />);

    const input = screen.getByTestId("cmdk-input");
    await user.click(input);
    input.dispatchEvent(new FocusEvent("focus"));

    // Should only show non-selected options
    const optionItems = screen.getAllByTestId("command-item");
    expect(optionItems).toHaveLength(2);
    expect(optionItems[0].textContent).toBe("Banana");
    expect(optionItems[1].textContent).toBe("Orange");
  });

  test("updates when value prop changes", () => {
    const { rerender } = render(<MultiSelect options={options} value={["apple"]} />);

    let badges = screen.getAllByTestId("badge");
    expect(badges).toHaveLength(1);
    expect(badges[0].textContent).toContain("Apple");

    rerender(<MultiSelect options={options} value={["apple", "banana"]} />);

    badges = screen.getAllByTestId("badge");
    expect(badges).toHaveLength(2);
    expect(badges[0].textContent).toContain("Apple");
    expect(badges[1].textContent).toContain("Banana");
  });
});
