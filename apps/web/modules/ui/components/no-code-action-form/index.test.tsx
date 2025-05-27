import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { useForm } from "react-hook-form";
import { afterEach, describe, expect, test, vi } from "vitest";
import { TActionClassInput } from "@formbricks/types/action-classes";
import { NoCodeActionForm } from ".";

// Mock the Alert component
vi.mock("@/modules/ui/components/alert", () => ({
  Alert: ({ children }: { children: React.ReactNode }) => <div data-testid="alert">{children}</div>,
  AlertTitle: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="alert-title">{children}</div>
  ),
  AlertDescription: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="alert-description">{children}</div>
  ),
}));

// Mock the form components
vi.mock("@/modules/ui/components/form", () => ({
  FormControl: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  FormField: ({ render, control }: any) =>
    render({
      field: {
        value: control?._formValues?.noCodeConfig?.type || "",
        onChange: vi.fn(),
      },
    }),
  FormItem: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  FormError: () => null,
}));

// Mock the TabToggle component
vi.mock("@/modules/ui/components/tab-toggle", () => ({
  TabToggle: ({ options, onChange, defaultSelected, id, disabled }: any) => (
    <div data-testid={`tab-toggle-${id}`}>
      {options.map((option: any) => (
        <button
          key={option.value}
          data-testid={`tab-option-${option.value}`}
          onClick={() => onChange(option.value)}
          data-selected={option.value === defaultSelected ? "true" : "false"}>
          {option.label}
        </button>
      ))}
    </div>
  ),
}));

// Mock the Label component
vi.mock("@/modules/ui/components/label", () => ({
  Label: ({ children, className }: any) => (
    <label data-testid="form-label" className={className}>
      {children}
    </label>
  ),
}));

// Mock child components
vi.mock("./components/css-selector", () => ({
  CssSelector: ({ form, disabled }: any) => (
    <div data-testid="css-selector" data-disabled={disabled}>
      CSS Selector
    </div>
  ),
}));

vi.mock("./components/inner-html-selector", () => ({
  InnerHtmlSelector: ({ form, disabled }: any) => (
    <div data-testid="inner-html-selector" data-disabled={disabled}>
      Inner HTML Selector
    </div>
  ),
}));

vi.mock("./components/page-url-selector", () => ({
  PageUrlSelector: ({ form, isReadOnly }: any) => (
    <div data-testid="page-url-selector" data-readonly={isReadOnly}>
      Page URL Selector
    </div>
  ),
}));

// Mock the tolgee translation
vi.mock("@tolgee/react", () => ({
  useTranslate: () => ({
    t: (key: string) => key,
  }),
}));

// Helper component for the form
const TestWrapper = ({
  noCodeConfig = { type: "click" },
  isReadOnly = false,
}: {
  noCodeConfig?: { type: "click" | "pageView" | "exitIntent" | "fiftyPercentScroll" };
  isReadOnly?: boolean;
}) => {
  const form = useForm<TActionClassInput>({
    defaultValues: {
      name: "Test Action",
      description: "Test Description",
      noCodeConfig,
    },
  });

  return <NoCodeActionForm form={form} isReadOnly={isReadOnly} />;
};

describe("NoCodeActionForm", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders the form with click type", () => {
    render(<TestWrapper noCodeConfig={{ type: "click" }} />);

    expect(screen.getByTestId("tab-toggle-userAction")).toBeInTheDocument();
    expect(screen.getByTestId("tab-option-click")).toHaveAttribute("data-selected", "true");
    expect(screen.getByTestId("css-selector")).toBeInTheDocument();
    expect(screen.getByTestId("inner-html-selector")).toBeInTheDocument();
    expect(screen.getByTestId("page-url-selector")).toBeInTheDocument();
  });

  test("renders the form with pageView type", () => {
    render(<TestWrapper noCodeConfig={{ type: "pageView" }} />);

    expect(screen.getByTestId("tab-option-pageView")).toHaveAttribute("data-selected", "true");
    expect(screen.getByTestId("alert")).toBeInTheDocument();
    expect(screen.getByTestId("alert-title")).toHaveTextContent("environments.actions.page_view");
  });

  test("renders the form with exitIntent type", () => {
    render(<TestWrapper noCodeConfig={{ type: "exitIntent" }} />);

    expect(screen.getByTestId("tab-option-exitIntent")).toHaveAttribute("data-selected", "true");
    expect(screen.getByTestId("alert")).toBeInTheDocument();
    expect(screen.getByTestId("alert-title")).toHaveTextContent("environments.actions.exit_intent");
  });

  test("renders the form with fiftyPercentScroll type", () => {
    render(<TestWrapper noCodeConfig={{ type: "fiftyPercentScroll" }} />);

    expect(screen.getByTestId("tab-option-fiftyPercentScroll")).toHaveAttribute("data-selected", "true");
    expect(screen.getByTestId("alert")).toBeInTheDocument();
    expect(screen.getByTestId("alert-title")).toHaveTextContent("environments.actions.fifty_percent_scroll");
  });

  test("passes isReadOnly to child components", () => {
    render(<TestWrapper isReadOnly={true} />);

    expect(screen.getByTestId("tab-toggle-userAction")).toBeInTheDocument();
    expect(screen.getByTestId("css-selector")).toHaveAttribute("data-disabled", "true");
    expect(screen.getByTestId("inner-html-selector")).toHaveAttribute("data-disabled", "true");
    expect(screen.getByTestId("page-url-selector")).toHaveAttribute("data-readonly", "true");
  });
});
