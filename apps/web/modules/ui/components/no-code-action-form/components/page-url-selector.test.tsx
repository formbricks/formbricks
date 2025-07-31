import { Select, SelectContent, SelectItem } from "@/modules/ui/components/select";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { useForm } from "react-hook-form";
import { afterEach, describe, expect, test, vi } from "vitest";
import { ACTION_CLASS_PAGE_URL_RULES, TActionClassInput } from "@formbricks/types/action-classes";
import { PageUrlSelector } from "./page-url-selector";

// Mock testURLmatch function
vi.mock("@/lib/utils/url", () => ({
  testURLmatch: vi.fn((testUrl, value, rule, t) => {
    // Updated mock implementation to match new function signature
    if (rule === "exactMatch") return testUrl === value;
    if (rule === "contains") return testUrl.includes(value);
    if (rule === "startsWith") return testUrl.startsWith(value);
    if (rule === "endsWith") return testUrl.endsWith(value);
    if (rule === "notMatch") return testUrl !== value;
    if (rule === "notContains") return !testUrl.includes(value);
    if (rule === "matchesRegex") {
      try {
        const regex = new RegExp(value);
        return regex.test(testUrl);
      } catch {
        throw new Error(t("environments.actions.invalid_regex"));
      }
    }
    throw new Error(t("environments.actions.invalid_match_type"));
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
      onChange={(e) => onChange?.(e)}
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
vi.mock("@/modules/ui/components/select", async () => {
  const React = await import("react");
  const SelectContext = React.createContext<{ onValueChange?: (value: string) => void }>({});

  return {
    Select: ({ children, value, name, disabled, onValueChange }: any) => {
      const contextValue = React.useMemo(() => ({ onValueChange }), [onValueChange]);
      return (
        <SelectContext.Provider value={contextValue}>
          <div data-testid={`select-${name}`} data-value={value} data-disabled={disabled}>
            {children}
          </div>
        </SelectContext.Provider>
      );
    },
    SelectContent: ({ children }: any) => <div data-testid="select-content">{children}</div>,
    SelectItem: ({ children, value }: any) => {
      const context = React.useContext(SelectContext);
      return (
        <button // NOSONAR // This is a mocked component to test the logic
          type="button"
          data-testid={`select-item-${value}`}
          data-value={value}
          onClick={() => context.onValueChange?.(value)}
          style={{ cursor: "pointer" }}>
          {children}
        </button>
      );
    },
    SelectTrigger: ({ children, className }: any) => (
      <div data-testid="select-trigger" className={className}>
        {children}
      </div>
    ),
    SelectValue: ({ placeholder }: any) => <div data-testid="select-value">{placeholder}</div>,
  };
});

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
  FormError: () => <div>Form Error</div>,
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
    rule: "startsWith" | "exactMatch" | "contains" | "endsWith" | "notMatch" | "notContains" | "matchesRegex";
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
    vi.clearAllMocks();
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

  test("test URL match functionality - successful match", async () => {
    const testUrl = "https://example.com/pricing";
    const urlFilters = [{ rule: "contains" as const, value: "pricing" }];

    render(<TestWrapper urlFilters={urlFilters} />);

    const testInput = screen.getByTestId("input-noCodeConfig.urlFilters.testUrl");
    const testButton = screen.getByTestId("button-environments.actions.test_match");

    await userEvent.type(testInput, testUrl);
    await userEvent.click(testButton);

    // Toast should be called to show successful match
    const toast = await import("react-hot-toast");
    expect(toast.default.success).toHaveBeenCalledWith(
      "environments.actions.your_survey_would_be_shown_on_this_url"
    );
  });

  test("test URL match functionality - no match", async () => {
    const testUrl = "https://example.com/dashboard";
    const urlFilters = [{ rule: "contains" as const, value: "pricing" }];

    render(<TestWrapper urlFilters={urlFilters} />);

    const testInput = screen.getByTestId("input-noCodeConfig.urlFilters.testUrl");
    const testButton = screen.getByTestId("button-environments.actions.test_match");

    await userEvent.type(testInput, testUrl);
    await userEvent.click(testButton);

    // Toast should be called to show no match
    const toast = await import("react-hot-toast");
    expect(toast.default.error).toHaveBeenCalledWith("environments.actions.your_survey_would_not_be_shown");
  });

  test("test URL match functionality with regex - valid regex", async () => {
    const testUrl = "https://example.com/user/123";
    const urlFilters = [{ rule: "matchesRegex" as const, value: "/user/\\d+" }];

    render(<TestWrapper urlFilters={urlFilters} />);

    const testInput = screen.getByTestId("input-noCodeConfig.urlFilters.testUrl");
    const testButton = screen.getByTestId("button-environments.actions.test_match");

    await userEvent.type(testInput, testUrl);
    await userEvent.click(testButton);

    // Toast should be called to show successful match
    const toast = await import("react-hot-toast");
    expect(toast.default.success).toHaveBeenCalledWith(
      "environments.actions.your_survey_would_be_shown_on_this_url"
    );
  });

  test("test URL match functionality with regex - invalid regex", async () => {
    const testUrl = "https://example.com/user/123";
    const urlFilters = [{ rule: "matchesRegex" as const, value: "[invalid-regex" }];

    render(<TestWrapper urlFilters={urlFilters} />);

    const testInput = screen.getByTestId("input-noCodeConfig.urlFilters.testUrl");
    const testButton = screen.getByTestId("button-environments.actions.test_match");

    await userEvent.type(testInput, testUrl);
    await userEvent.click(testButton);

    // Toast should be called to show error
    const toast = await import("react-hot-toast");
    expect(toast.default.error).toHaveBeenCalledWith("environments.actions.invalid_regex");
  });

  test("test URL match functionality with regex - no match", async () => {
    const testUrl = "https://example.com/user/abc";
    const urlFilters = [{ rule: "matchesRegex" as const, value: "/user/\\d+" }];

    render(<TestWrapper urlFilters={urlFilters} />);

    const testInput = screen.getByTestId("input-noCodeConfig.urlFilters.testUrl");
    const testButton = screen.getByTestId("button-environments.actions.test_match");

    await userEvent.type(testInput, testUrl);
    await userEvent.click(testButton);

    // Toast should be called to show no match
    const toast = await import("react-hot-toast");
    expect(toast.default.error).toHaveBeenCalledWith("environments.actions.your_survey_would_not_be_shown");
  });

  test("handles multiple URL filters with OR logic", async () => {
    const testUrl = "https://example.com/pricing";
    const urlFilters = [
      { rule: "contains" as const, value: "dashboard" },
      { rule: "contains" as const, value: "pricing" },
    ];

    render(<TestWrapper urlFilters={urlFilters} />);

    const testInput = screen.getByTestId("input-noCodeConfig.urlFilters.testUrl");
    const testButton = screen.getByTestId("button-environments.actions.test_match");

    await userEvent.type(testInput, testUrl);
    await userEvent.click(testButton);

    // Should match because one of the filters matches (OR logic)
    const toast = await import("react-hot-toast");
    expect(toast.default.success).toHaveBeenCalledWith(
      "environments.actions.your_survey_would_be_shown_on_this_url"
    );
  });

  test("shows correct placeholder for regex input", () => {
    const urlFilters = [{ rule: "matchesRegex" as const, value: "" }];

    render(<TestWrapper urlFilters={urlFilters} />);

    const input = screen.getByTestId("input-noCodeConfig.urlFilters.0.value");
    expect(input).toHaveAttribute("placeholder", "environments.actions.add_regular_expression_here");
  });

  test("shows correct placeholder for non-regex input", () => {
    const urlFilters = [{ rule: "exactMatch" as const, value: "" }];

    render(<TestWrapper urlFilters={urlFilters} />);

    const input = screen.getByTestId("input-noCodeConfig.urlFilters.0.value");
    expect(input).toHaveAttribute("placeholder", "environments.actions.enter_url");
  });

  test("renders all available rule options from ACTION_CLASS_PAGE_URL_RULES", () => {
    render(<TestWrapper urlFilters={[{ rule: "exactMatch", value: "https://example.com" }]} />);

    // Check that all rule options are rendered
    ACTION_CLASS_PAGE_URL_RULES.forEach((rule) => {
      expect(screen.getByTestId(`select-item-${rule}`)).toBeInTheDocument();
    });
  });

  test("displays correct translated labels for each rule type", () => {
    render(<TestWrapper urlFilters={[{ rule: "exactMatch", value: "https://example.com" }]} />);

    // Test that each rule has the correct translated label
    expect(screen.getByTestId("select-item-exactMatch")).toHaveTextContent(
      "environments.actions.exactly_matches"
    );
    expect(screen.getByTestId("select-item-contains")).toHaveTextContent("environments.actions.contains");
    expect(screen.getByTestId("select-item-startsWith")).toHaveTextContent(
      "environments.actions.starts_with"
    );
    expect(screen.getByTestId("select-item-endsWith")).toHaveTextContent("environments.actions.ends_with");
    expect(screen.getByTestId("select-item-notMatch")).toHaveTextContent(
      "environments.actions.does_not_exactly_match"
    );
    expect(screen.getByTestId("select-item-notContains")).toHaveTextContent(
      "environments.actions.does_not_contain"
    );
    expect(screen.getByTestId("select-item-matchesRegex")).toHaveTextContent(
      "environments.actions.matches_regex"
    );
  });

  test("test input styling changes based on match result", async () => {
    const testUrl = "https://example.com/pricing";
    const urlFilters = [{ rule: "contains" as const, value: "pricing" }];

    render(<TestWrapper urlFilters={urlFilters} />);

    const testInput = screen.getByTestId("input-noCodeConfig.urlFilters.testUrl");
    const testButton = screen.getByTestId("button-environments.actions.test_match");

    // Test URL that should match
    await userEvent.type(testInput, testUrl);
    await userEvent.click(testButton);

    // The input should have success styling (this tests the useMemo matchClass logic)
    expect(testInput).toHaveClass("border-green-500", "bg-green-50");
  });

  test("test input styling for no match", async () => {
    const testUrl = "https://example.com/dashboard";
    const urlFilters = [{ rule: "contains" as const, value: "pricing" }];

    render(<TestWrapper urlFilters={urlFilters} />);

    const testInput = screen.getByTestId("input-noCodeConfig.urlFilters.testUrl");
    const testButton = screen.getByTestId("button-environments.actions.test_match");

    await userEvent.type(testInput, testUrl);
    await userEvent.click(testButton);

    // The input should have error styling
    expect(testInput).toHaveClass("border-red-200", "bg-red-50");
  });

  test("test input has default styling before any test", () => {
    const urlFilters = [{ rule: "contains" as const, value: "pricing" }];

    render(<TestWrapper urlFilters={urlFilters} />);

    const testInput = screen.getByTestId("input-noCodeConfig.urlFilters.testUrl");

    // The input should have default styling
    expect(testInput).toHaveClass("border-slate-200");
  });

  test("resets match state when test URL is changed", async () => {
    const urlFilters = [{ rule: "contains" as const, value: "pricing" }];

    render(<TestWrapper urlFilters={urlFilters} />);

    const testInput = screen.getByTestId("input-noCodeConfig.urlFilters.testUrl");
    const testButton = screen.getByTestId("button-environments.actions.test_match");

    // First, perform a test that matches
    await userEvent.type(testInput, "https://example.com/pricing");
    await userEvent.click(testButton);

    // Verify the input has success styling
    expect(testInput).toHaveClass("border-green-500", "bg-green-50");

    // Clear and type new URL
    await userEvent.clear(testInput);
    await userEvent.type(testInput, "https://example.com/dashboard");

    // The styling should reset to default while typing
    expect(testInput).toHaveClass("border-slate-200");
  });

  test("Select mock properly handles different selection values", async () => {
    const mockOnValueChange = vi.fn();

    render(
      <div>
        <Select name="test-select" onValueChange={mockOnValueChange}>
          <SelectContent>
            <SelectItem value="exactMatch">Exact Match</SelectItem>
            <SelectItem value="contains">Contains</SelectItem>
            <SelectItem value="startsWith">Starts With</SelectItem>
          </SelectContent>
        </Select>
      </div>
    );

    // Test clicking different select items
    const exactMatchItem = screen.getByTestId("select-item-exactMatch");
    const containsItem = screen.getByTestId("select-item-contains");
    const startsWithItem = screen.getByTestId("select-item-startsWith");

    // Click exactMatch
    await userEvent.click(exactMatchItem);
    expect(mockOnValueChange).toHaveBeenCalledWith("exactMatch");

    // Click contains
    await userEvent.click(containsItem);
    expect(mockOnValueChange).toHaveBeenCalledWith("contains");

    // Click startsWith
    await userEvent.click(startsWithItem);
    expect(mockOnValueChange).toHaveBeenCalledWith("startsWith");

    // Verify each call was made with the correct value
    expect(mockOnValueChange).toHaveBeenCalledTimes(3);
  });
});
