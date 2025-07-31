import { cleanup, render, screen } from "@testing-library/react";
import { FormProvider, useForm } from "react-hook-form";
import { afterEach, describe, expect, test, vi } from "vitest";
import { CodeActionForm } from "./index";

// Mock components used in the CodeActionForm
vi.mock("@/modules/ui/components/alert", () => ({
  Alert: ({ children }: { children: React.ReactNode }) => <div data-testid="alert">{children}</div>,
  AlertTitle: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="alert-title">{children}</div>
  ),
  AlertDescription: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="alert-description">{children}</div>
  ),
}));

vi.mock("@/modules/ui/components/form", () => ({
  FormControl: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="form-control">{children}</div>
  ),
  FormField: ({ name, render }: any) => {
    // Create a mock field with essential properties
    const field = {
      value: name === "key" ? "test-action" : "",
      onChange: vi.fn(),
      onBlur: vi.fn(),
      name: name,
      ref: vi.fn(),
    };
    return render({ field, fieldState: { error: null } });
  },
  FormItem: ({ children }: { children: React.ReactNode }) => <div data-testid="form-item">{children}</div>,
  FormLabel: ({ children }: { children: React.ReactNode }) => <div data-testid="form-label">{children}</div>,
  FormError: () => <div data-testid="form-error">Form Error</div>,
}));

vi.mock("@/modules/ui/components/input", () => ({
  Input: (props: any) => (
    <input
      data-testid="input"
      id={props.id}
      placeholder={props.placeholder}
      className={props.className}
      value={props.value || ""}
      onChange={props.onChange}
      readOnly={props.readOnly}
      disabled={props.disabled}
      aria-invalid={props.isInvalid}
    />
  ),
}));

// Testing component wrapper to provide form context
const TestWrapper = ({ isReadOnly = false }) => {
  const methods = useForm({
    defaultValues: {
      key: "test-action",
    },
  });

  return (
    <FormProvider {...methods}>
      <CodeActionForm form={methods} isReadOnly={isReadOnly} />
    </FormProvider>
  );
};

describe("CodeActionForm", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders form with input and description", () => {
    render(<TestWrapper />);

    // Check form label
    expect(screen.getByTestId("form-label")).toHaveTextContent("common.key");

    // Check input
    const input = screen.getByTestId("input");
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute("id", "codeActionKeyInput");
    expect(input).toHaveAttribute("placeholder", "environments.actions.eg_download_cta_click_on_home");

    // Check alert with terminal icon and instructions
    const alert = screen.getByTestId("alert");
    expect(alert).toBeInTheDocument();
    expect(screen.getByTestId("alert-title")).toHaveTextContent(
      "environments.actions.how_do_code_actions_work"
    );
    expect(screen.getByTestId("alert-description")).toContainHTML("formbricks.track");

    // Check docs link
    const link = screen.getByText("common.docs");
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "https://formbricks.com/docs/actions/code");
    expect(link).toHaveAttribute("target", "_blank");
  });

  test("applies readonly and disabled attributes when isReadOnly is true", () => {
    render(<TestWrapper isReadOnly={true} />);

    const input = screen.getByTestId("input");
    expect(input).toBeDisabled();
    expect(input).toHaveAttribute("readonly");
  });

  test("input is enabled and editable when isReadOnly is false", () => {
    render(<TestWrapper isReadOnly={false} />);

    const input = screen.getByTestId("input");
    expect(input).not.toBeDisabled();
    expect(input).not.toHaveAttribute("readonly");
  });
});
