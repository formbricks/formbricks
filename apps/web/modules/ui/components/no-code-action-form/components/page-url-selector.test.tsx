import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useForm } from "react-hook-form";
import { afterEach, describe, expect, test, vi } from "vitest";
import { TActionClassInput } from "@formbricks/types/action-classes";
import { PageUrlSelector } from "./page-url-selector";

// Mock testURLmatch function
vi.mock("@/lib/utils/url", () => ({
  testURLmatch: vi.fn((testUrl, value, rule) => {
    // Simple mock implementation
    if (rule === "exactMatch" && testUrl === value) return "yes";
    if (rule === "contains" && testUrl.includes(value)) return "yes";
    if (rule === "startsWith" && testUrl.startsWith(value)) return "yes";
    if (rule === "endsWith" && testUrl.endsWith(value)) return "yes";
    if (rule === "notMatch" && testUrl !== value) return "yes";
    if (rule === "notContains" && !testUrl.includes(value)) return "yes";
    return "no";
  }),
}));

// Mock toast
vi.mock("react-hot-toast", () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock the TabToggle component
vi.mock("@/modules/ui/components/tab-toggle", () => ({
  TabToggle: ({ options, onChange, defaultSelected, id, disabled }: any) => (
    <div data-testid={`tab-toggle-${id}`} data-disabled={disabled}>
      {options.map((option: any) => (
        <button
          key={option.value}
          data-testid={`tab-option-${option.value}`}
          onClick={() => onChange(option.value)}
          data-selected={option.value === defaultSelected}>
          {option.label}
        </button>
      ))}
    </div>
  ),
}));

// Mock the Input component
vi.mock("@/modules/ui/components/input", () => ({
  Input: ({
    className,
    type,
    disabled,
    placeholder,
    onChange,
    value,
    isInvalid,
    name,
    autoComplete,
    ...rest
  }: any) => (
    <input
      data-testid={name ? `input-${name}` : "input"}
      type={type}
      className={className}
      placeholder={placeholder}
      disabled={disabled}
      value={value || ""}
      onChange={(e) => onChange && onChange(e)}
      data-invalid={isInvalid}
      autoComplete={autoComplete}
      {...rest}
    />
  ),
}));

// Mock the Button component - Fixed to use correct data-testid values
vi.mock("@/modules/ui/components/button", () => ({
  Button: ({ children, variant, size, onClick, disabled, className, type }: any) => (
    <button
      data-testid={
        typeof children === "string"
          ? `button-${children.toLowerCase().replace(/\s+/g, "-")}`
          : "button-add-url"
      }
      data-variant={variant}
      data-size={size}
      onClick={onClick}
      disabled={disabled}
      className={className}
      type={type}>
      {children}
    </button>
  ),
}));

// Mock the Select component
vi.mock("@/modules/ui/components/select", () => ({
  Select: ({ children, onValueChange, value, name, disabled }: any) => (
    <div data-testid={`select-${name}`} data-value={value} data-disabled={disabled}>
      {children}
    </div>
  ),
  SelectContent: ({ children }: any) => <div data-testid="select-content">{children}</div>,
  SelectItem: ({ children, value }: any) => (
    <div data-testid={`select-item-${value}`} data-value={value}>
      {children}
    </div>
  ),
  SelectTrigger: ({ children, className }: any) => (
    <div data-testid="select-trigger" className={className}>
      {children}
    </div>
  ),
  SelectValue: ({ placeholder }: any) => <div data-testid="select-value">{placeholder}</div>,
}));

// Mock the Label component
vi.mock("@/modules/ui/components/label", () => ({
  Label: ({ children, className }: any) => (
    <label data-testid="form-label" className={className}>
      {children}
    </label>
  ),
}));

// Mock icons
vi.mock("lucide-react", () => ({
  PlusIcon: () => <div data-testid="plus-icon" />,
  TrashIcon: () => <div data-testid="trash-icon" />,
}));

// Mock the form components
vi.mock("@/modules/ui/components/form", () => ({
  FormControl: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  FormField: ({ render, control, name }: any) =>
    render({
      field: {
        onChange: vi.fn(),
        value: (() => {
          if (name === "noCodeConfig.urlFilters") {
            return control?._formValues?.noCodeConfig?.urlFilters || [];
          }
          if (name?.startsWith("noCodeConfig.urlFilters.")) {
            const parts = name.split(".");
            const index = parseInt(parts[2]);
            const property = parts[3];
            return control?._formValues?.noCodeConfig?.urlFilters?.[index]?.[property] || "";
          }
          return "";
        })(),
        name,
      },
      fieldState: { error: null },
    }),
  FormItem: ({ children, className }: any) => <div className={className}>{children}</div>,
}));

// Mock the tolgee translation
vi.mock("@tolgee/react", () => ({
  useTranslate: () => ({
    t: (key: string) => key,
  }),
}));

// Helper component for the form
const TestWrapper = ({
  urlFilters = [] as {
    rule: "startsWith" | "exactMatch" | "contains" | "endsWith" | "notMatch" | "notContains";
    value: string;
  }[],
  isReadOnly = false,
}) => {
  const form = useForm<TActionClassInput>({
    defaultValues: {
      name: "Test Action",
      description: "Test Description",
      noCodeConfig: {
        type: "click",
        urlFilters,
      },
    },
  });

  return <PageUrlSelector form={form} isReadOnly={isReadOnly} />;
};

describe("PageUrlSelector", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders with default values and 'all' filter type", () => {
    render(<TestWrapper />);

    expect(screen.getByTestId("form-label")).toBeInTheDocument();
    expect(screen.getByText("environments.actions.page_filter")).toBeInTheDocument();
    expect(screen.getByTestId("tab-toggle-filter")).toBeInTheDocument();
    expect(screen.getByTestId("tab-option-all")).toHaveAttribute("data-selected", "true");
    expect(screen.queryByTestId("button-add-url")).not.toBeInTheDocument();
  });

  test("renders with 'specific' filter type", () => {
    render(<TestWrapper urlFilters={[{ rule: "exactMatch", value: "https://example.com" }]} />);

    expect(screen.getByTestId("tab-option-specific")).toHaveAttribute("data-selected", "true");
    expect(screen.getByTestId("select-noCodeConfig.urlFilters.0.rule")).toBeInTheDocument();
    expect(screen.getByTestId("button-add-url")).toBeInTheDocument();
    expect(screen.getByTestId("input-noCodeConfig.urlFilters.testUrl")).toBeInTheDocument();
  });

  test("disables components when isReadOnly is true", () => {
    render(
      <TestWrapper urlFilters={[{ rule: "exactMatch", value: "https://example.com" }]} isReadOnly={true} />
    );

    expect(screen.getByTestId("tab-toggle-filter")).toHaveAttribute("data-disabled", "true");
    expect(screen.getByTestId("button-add-url")).toHaveAttribute("disabled", "");
  });

  test("shows multiple URL filters", () => {
    const urlFilters = [
      { rule: "exactMatch" as const, value: "https://example.com" },
      { rule: "contains" as const, value: "pricing" },
    ];

    render(<TestWrapper urlFilters={urlFilters} />);

    expect(screen.getByTestId("select-noCodeConfig.urlFilters.0.rule")).toBeInTheDocument();
    expect(screen.getByTestId("select-noCodeConfig.urlFilters.1.rule")).toBeInTheDocument();
    // Check that we have a "trash" button for each rule (since there are multiple)
    const trashIcons = screen.getAllByTestId("trash-icon");
    expect(trashIcons.length).toBe(2);
  });

  test("test URL match functionality", async () => {
    const testUrl = "https://example.com/pricing";
    const urlFilters = [{ rule: "contains" as const, value: "pricing" }];

    render(<TestWrapper urlFilters={urlFilters} />);

    const testInput = screen.getByTestId("input-noCodeConfig.urlFilters.testUrl");
    // Updated testId to match the actual button's testId from our mock
    const testButton = screen.getByTestId("button-environments.actions.test_match");

    await userEvent.type(testInput, testUrl);
    await userEvent.click(testButton);

    // Toast should be called to show match result
    const toast = await import("react-hot-toast");
    expect(toast.default.success).toHaveBeenCalled();
  });
});
