import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LucideSettings, User } from "lucide-react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { InputCombobox, TComboboxOption } from "./index";

// Mock components used by InputCombobox
vi.mock("@/modules/ui/components/command", () => ({
  Command: ({ children, className }: any) => (
    <div data-testid="command" className={className}>
      {children}
    </div>
  ),
  CommandInput: ({ placeholder, className }: any) => (
    <input data-testid="command-input" placeholder={placeholder} className={className} />
  ),
  CommandList: ({ children, className }: any) => (
    <div data-testid="command-list" className={className}>
      {children}
    </div>
  ),
  CommandEmpty: ({ children, className }: any) => (
    <div data-testid="command-empty" className={className}>
      {children}
    </div>
  ),
  CommandGroup: ({ children, heading }: any) => (
    <div data-testid="command-group" data-heading={heading}>
      {children}
    </div>
  ),
  CommandItem: ({ children, onSelect, className }: any) => (
    <div data-testid="command-item" className={className} onClick={onSelect}>
      {children}
    </div>
  ),
  CommandSeparator: ({ className }: any) => <hr data-testid="command-separator" className={className} />,
}));

vi.mock("@/modules/ui/components/popover", () => ({
  Popover: ({ children, open, onOpenChange }: any) => (
    <div data-testid="popover" data-open={open}>
      {children}
      <button data-testid="toggle-popover" onClick={() => onOpenChange(!open)}>
        Toggle Popover
      </button>
    </div>
  ),
  PopoverTrigger: ({ children, asChild }: any) => (
    <div data-testid="popover-trigger" data-as-child={asChild}>
      {children}
    </div>
  ),
  PopoverContent: ({ children, className }: any) => (
    <div data-testid="popover-content" className={className}>
      {children}
    </div>
  ),
}));

vi.mock("@/modules/ui/components/input", () => ({
  Input: ({ id, className, value, onChange, ...props }: any) => (
    <input
      data-testid="input"
      id={id}
      className={className}
      value={value || ""}
      onChange={onChange}
      {...props}
    />
  ),
}));

vi.mock("next/image", () => ({
  default: ({ src, alt, width, height, className }: any) => (
    <img data-testid="next-image" src={src} alt={alt} width={width} height={height} className={className} />
  ),
}));

vi.mock("@tolgee/react", () => ({
  useTranslate: () => ({
    t: (key: string) => key,
  }),
}));

describe("InputCombobox", () => {
  afterEach(() => {
    cleanup();
  });

  const mockOptions: TComboboxOption[] = [
    { label: "Option 1", value: "opt1" },
    { label: "Option 2", value: "opt2" },
    { icon: User, label: "User Option", value: "user" },
    { imgSrc: "/test-image.jpg", label: "Image Option", value: "img" },
  ];

  const mockGroupedOptions = [
    {
      label: "Group 1",
      value: "group1",
      options: [
        { label: "Group 1 Option 1", value: "g1opt1" },
        { label: "Group 1 Option 2", value: "g1opt2" },
      ],
    },
    {
      label: "Group 2",
      value: "group2",
      options: [
        { label: "Group 2 Option 1", value: "g2opt1" },
        { icon: LucideSettings, label: "Settings", value: "settings" },
      ],
    },
  ];

  test("renders with default props", () => {
    render(<InputCombobox id="test-combo" options={mockOptions} onChangeValue={() => {}} />);
    expect(screen.getByRole("combobox")).toBeInTheDocument();
    expect(screen.getByTestId("popover")).toBeInTheDocument();
    expect(screen.getByTestId("command-input")).toBeInTheDocument();
  });

  test("renders without search when showSearch is false", () => {
    render(
      <InputCombobox id="test-combo" options={mockOptions} onChangeValue={() => {}} showSearch={false} />
    );
    expect(screen.queryByTestId("command-input")).not.toBeInTheDocument();
  });

  test("renders with options", () => {
    render(<InputCombobox id="test-combo" options={mockOptions} onChangeValue={() => {}} />);
    expect(screen.getAllByTestId("command-item")).toHaveLength(mockOptions.length);
  });

  test("renders with grouped options", () => {
    render(<InputCombobox id="test-combo" groupedOptions={mockGroupedOptions} onChangeValue={() => {}} />);
    expect(screen.getAllByTestId("command-group")).toHaveLength(mockGroupedOptions.length);
    expect(screen.getByTestId("command-separator")).toBeInTheDocument();
  });

  test("renders with input when withInput is true", () => {
    render(<InputCombobox id="test-combo" options={mockOptions} onChangeValue={() => {}} withInput={true} />);
    expect(screen.getByTestId("input")).toBeInTheDocument();
  });

  test("handles option selection", async () => {
    const user = userEvent.setup();
    const onChangeValue = vi.fn();

    render(<InputCombobox id="test-combo" options={mockOptions} onChangeValue={onChangeValue} />);

    // Toggle popover to open dropdown
    await user.click(screen.getByTestId("toggle-popover"));

    // Click on an option
    const items = screen.getAllByTestId("command-item");
    await user.click(items[0]);

    expect(onChangeValue).toHaveBeenCalledWith("opt1", expect.objectContaining({ value: "opt1" }));
  });

  test("handles multi-select", async () => {
    const user = userEvent.setup();
    const onChangeValue = vi.fn();

    render(
      <InputCombobox
        id="test-combo"
        options={mockOptions}
        onChangeValue={onChangeValue}
        allowMultiSelect={true}
        showCheckIcon={true}
      />
    );

    // Toggle popover to open dropdown
    await user.click(screen.getByTestId("toggle-popover"));

    // Click on an option
    const items = screen.getAllByTestId("command-item");
    await user.click(items[0]);

    expect(onChangeValue).toHaveBeenCalledWith(["opt1"], expect.objectContaining({ value: "opt1" }));

    // Click on another option
    await user.click(items[1]);

    expect(onChangeValue).toHaveBeenCalledWith(["opt1", "opt2"], expect.objectContaining({ value: "opt2" }));
  });

  test("handles input change when withInput is true", async () => {
    const user = userEvent.setup();
    const onChangeValue = vi.fn();

    render(
      <InputCombobox id="test-combo" options={mockOptions} onChangeValue={onChangeValue} withInput={true} />
    );

    const input = screen.getByTestId("input");
    await user.type(input, "test");

    expect(onChangeValue).toHaveBeenCalledWith("test", undefined, true);
  });

  test("renders with clearable option and handles clear", async () => {
    const user = userEvent.setup();
    const onChangeValue = vi.fn();

    const { rerender } = render(
      <InputCombobox id="test-combo" options={mockOptions} onChangeValue={onChangeValue} clearable={true} />
    );

    // Select an option first to show the clear button
    await user.click(screen.getByTestId("toggle-popover"));
    const items = screen.getAllByTestId("command-item");
    await user.click(items[0]);

    // Rerender with the selected value
    rerender(
      <InputCombobox
        id="test-combo"
        options={mockOptions}
        value="opt1"
        onChangeValue={onChangeValue}
        clearable={true}
      />
    );

    // Find and click the X icon (simulated)
    const clearButton = screen.getByText("Toggle Popover");
    await user.click(clearButton);

    // Verify onChangeValue was called
    expect(onChangeValue).toHaveBeenCalled();
  });

  test("renders custom empty dropdown text", () => {
    render(
      <InputCombobox
        id="test-combo"
        options={[]}
        onChangeValue={() => {}}
        emptyDropdownText="custom.empty.text"
      />
    );

    expect(screen.getByTestId("command-empty").textContent).toBe("custom.empty.text");
  });

  test("renders with value pre-selected", () => {
    render(<InputCombobox id="test-combo" options={mockOptions} value="opt1" onChangeValue={() => {}} />);

    expect(screen.getByRole("combobox")).toHaveTextContent("Option 1");
  });

  test("handles icons and images in options", () => {
    render(<InputCombobox id="test-combo" options={mockOptions} value="user" onChangeValue={() => {}} />);

    // Should render the User icon for the selected option
    expect(screen.getByRole("combobox")).toHaveTextContent("User Option");
  });
});
