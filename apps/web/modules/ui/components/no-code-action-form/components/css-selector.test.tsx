import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useForm } from "react-hook-form";
import { afterEach, describe, expect, test, vi } from "vitest";
import { TActionClassInput } from "@formbricks/types/action-classes";
import { CssSelector } from "./css-selector";

// Mock the AdvancedOptionToggle component
vi.mock("@/modules/ui/components/advanced-option-toggle", () => ({
  AdvancedOptionToggle: ({ children, isChecked, onToggle, title, disabled, htmlId }: any) => {
    // Store a reference to onToggle so we can actually toggle state when the button is clicked
    const handleToggle = () => onToggle(!isChecked);

    return (
      <div data-testid="advanced-option-toggle" data-checked={isChecked} data-disabled={disabled}>
        <div data-testid="toggle-title">{title}</div>
        <button data-testid={`toggle-button-${htmlId}`} onClick={handleToggle}>
          Toggle
        </button>
        {isChecked && <div data-testid="toggle-content">{children}</div>}
      </div>
    );
  },
}));

// Mock the Input component
vi.mock("@/modules/ui/components/input", () => ({
  Input: ({ disabled, placeholder, onChange, value, isInvalid }: any) => (
    <input
      data-testid="css-input"
      placeholder={placeholder}
      disabled={disabled}
      value={value || ""}
      onChange={(e) => onChange && onChange(e)}
      data-invalid={isInvalid}
    />
  ),
}));

// Mock the form components
vi.mock("@/modules/ui/components/form", () => ({
  FormControl: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  FormField: ({ render, name }: any) =>
    render({
      field: {
        value: undefined,
        onChange: vi.fn(),
        name,
      },
      fieldState: { error: null },
    }),
  FormItem: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

// Mock the tolgee translation
vi.mock("@tolgee/react", () => ({
  useTranslate: () => ({
    t: (key: string) => key,
  }),
}));

// Helper component for the form
const TestWrapper = ({ cssSelector, disabled = false }: { cssSelector?: string; disabled?: boolean }) => {
  const form = useForm<TActionClassInput>({
    defaultValues: {
      name: "Test Action",
      description: "Test Description",
      noCodeConfig: {
        type: "click",
        elementSelector: {
          cssSelector,
        },
      },
    },
  });

  // Override the watch function to simulate the state change
  form.watch = vi.fn().mockImplementation((name) => {
    if (name === "noCodeConfig.elementSelector.cssSelector") {
      return cssSelector;
    }
    return undefined;
  });

  return <CssSelector form={form} disabled={disabled} />;
};

describe("CssSelector", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders with cssSelector undefined", () => {
    render(<TestWrapper cssSelector={undefined} />);

    expect(screen.getByTestId("advanced-option-toggle")).toBeInTheDocument();
    expect(screen.getByTestId("toggle-title")).toHaveTextContent("environments.actions.css_selector");
    expect(screen.getByTestId("advanced-option-toggle")).toHaveAttribute("data-checked", "false");
    expect(screen.queryByTestId("toggle-content")).not.toBeInTheDocument();
  });

  test("renders with cssSelector defined", () => {
    render(<TestWrapper cssSelector=".button" />);

    expect(screen.getByTestId("advanced-option-toggle")).toBeInTheDocument();
    expect(screen.getByTestId("advanced-option-toggle")).toHaveAttribute("data-checked", "true");
    expect(screen.getByTestId("toggle-content")).toBeInTheDocument();
    expect(screen.getByTestId("css-input")).toBeInTheDocument();
  });

  test("disables the component when disabled prop is true", () => {
    render(<TestWrapper disabled={true} />);

    expect(screen.getByTestId("advanced-option-toggle")).toHaveAttribute("data-disabled", "true");
  });

  test("toggle opens and closes the input field", async () => {
    const user = userEvent.setup();
    // Start with cssSelector undefined to have the toggle closed initially
    const { rerender } = render(<TestWrapper cssSelector={undefined} />);

    const toggleButton = screen.getByTestId("toggle-button-CssSelector");

    // Initially closed
    expect(screen.queryByTestId("toggle-content")).not.toBeInTheDocument();

    // Open it - simulate change through rerender
    await user.click(toggleButton);
    rerender(<TestWrapper cssSelector="" />);
    expect(screen.getByTestId("advanced-option-toggle")).toHaveAttribute("data-checked", "true");

    // Close it again
    await user.click(toggleButton);
    rerender(<TestWrapper cssSelector={undefined} />);
    expect(screen.getByTestId("advanced-option-toggle")).toHaveAttribute("data-checked", "false");
  });
});
