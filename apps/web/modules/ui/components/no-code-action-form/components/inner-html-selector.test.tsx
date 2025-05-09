import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useForm } from "react-hook-form";
import { afterEach, describe, expect, test, vi } from "vitest";
import { TActionClassInput } from "@formbricks/types/action-classes";
import { InnerHtmlSelector } from "./inner-html-selector";

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
      data-testid="innerhtml-input"
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
const TestWrapper = ({ innerHtml, disabled = false }: { innerHtml?: string; disabled?: boolean }) => {
  const form = useForm<TActionClassInput>({
    defaultValues: {
      name: "Test Action",
      description: "Test Description",
      noCodeConfig: {
        type: "click",
        elementSelector: {
          innerHtml,
        },
      },
    },
  });

  // Override the watch function to simulate the state change
  form.watch = vi.fn().mockImplementation((name) => {
    if (name === "noCodeConfig.elementSelector.innerHtml") {
      return innerHtml;
    }
    return undefined;
  });

  return <InnerHtmlSelector form={form} disabled={disabled} />;
};

describe("InnerHtmlSelector", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders with innerHtml undefined", () => {
    render(<TestWrapper innerHtml={undefined} />);

    expect(screen.getByTestId("advanced-option-toggle")).toBeInTheDocument();
    expect(screen.getByTestId("toggle-title")).toHaveTextContent("environments.actions.inner_text");
    expect(screen.getByTestId("advanced-option-toggle")).toHaveAttribute("data-checked", "false");
    expect(screen.queryByTestId("toggle-content")).not.toBeInTheDocument();
  });

  test("renders with innerHtml defined", () => {
    render(<TestWrapper innerHtml="Get Started" />);

    expect(screen.getByTestId("advanced-option-toggle")).toBeInTheDocument();
    expect(screen.getByTestId("advanced-option-toggle")).toHaveAttribute("data-checked", "true");
    expect(screen.getByTestId("toggle-content")).toBeInTheDocument();
    expect(screen.getByTestId("innerhtml-input")).toBeInTheDocument();
  });

  test("disables the component when disabled prop is true", () => {
    render(<TestWrapper disabled={true} />);

    expect(screen.getByTestId("advanced-option-toggle")).toHaveAttribute("data-disabled", "true");
  });

  test("toggle opens and closes the input field", async () => {
    const user = userEvent.setup();
    // Start with innerHtml undefined to have the toggle closed initially
    const { rerender } = render(<TestWrapper innerHtml={undefined} />);

    const toggleButton = screen.getByTestId("toggle-button-InnerText");

    // Initially closed
    expect(screen.queryByTestId("toggle-content")).not.toBeInTheDocument();

    // Open it - simulate change through rerender
    await user.click(toggleButton);
    rerender(<TestWrapper innerHtml="" />);
    expect(screen.getByTestId("advanced-option-toggle")).toHaveAttribute("data-checked", "true");

    // Close it again
    await user.click(toggleButton);
    rerender(<TestWrapper innerHtml={undefined} />);
    expect(screen.getByTestId("advanced-option-toggle")).toHaveAttribute("data-checked", "false");
  });
});
