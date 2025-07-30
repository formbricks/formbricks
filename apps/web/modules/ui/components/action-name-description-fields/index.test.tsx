import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useForm } from "react-hook-form";
import { afterEach, describe, expect, test, vi } from "vitest";
import { TActionClassInput } from "@formbricks/types/action-classes";
import { ActionNameDescriptionFields } from "./index";

// Mock the form components
vi.mock("@/modules/ui/components/form", () => ({
  FormControl: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="form-control">{children}</div>
  ),
  FormField: ({ name, render }: any) => {
    const field = {
      value: "",
      onChange: vi.fn(),
      onBlur: vi.fn(),
      name: name,
      ref: vi.fn(),
    };
    const fieldState = { error: null };
    return render({ field, fieldState });
  },
  FormItem: ({ children }: { children: React.ReactNode }) => <div data-testid="form-item">{children}</div>,
  FormLabel: ({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) => (
    <label data-testid="form-label" htmlFor={htmlFor}>
      {children}
    </label>
  ),
  FormError: () => <div data-testid="form-error">Form Error</div>,
}));

// Mock the Input component
vi.mock("@/modules/ui/components/input", () => ({
  Input: ({ type, id, placeholder, disabled, isInvalid, ...props }: any) => (
    <input
      data-testid={`input-${id}`}
      type={type}
      id={id}
      placeholder={placeholder}
      disabled={disabled}
      data-invalid={isInvalid}
      {...props}
    />
  ),
}));

// Test wrapper component
const TestWrapper = ({
  isReadOnly = false,
  nameInputId = "actionNameInput",
  descriptionInputId = "actionDescriptionInput",
  showSeparator = false,
}: {
  isReadOnly?: boolean;
  nameInputId?: string;
  descriptionInputId?: string;
  showSeparator?: boolean;
}) => {
  const { control } = useForm<TActionClassInput>({
    defaultValues: {
      name: "",
      description: "",
    },
  });

  return (
    <ActionNameDescriptionFields
      control={control}
      isReadOnly={isReadOnly}
      nameInputId={nameInputId}
      descriptionInputId={descriptionInputId}
    />
  );
};

// Test wrapper with default props
const TestWrapperDefault = () => {
  const { control } = useForm<TActionClassInput>({
    defaultValues: {
      name: "",
      description: "",
    },
  });

  return <ActionNameDescriptionFields control={control} />;
};

describe("ActionNameDescriptionFields", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  test("renders name and description fields correctly", () => {
    render(<TestWrapper />);

    expect(screen.getByTestId("input-actionNameInput")).toBeInTheDocument();
    expect(screen.getByTestId("input-actionDescriptionInput")).toBeInTheDocument();
    expect(screen.getByText("environments.actions.what_did_your_user_do")).toBeInTheDocument();
    expect(screen.getByText("common.description")).toBeInTheDocument();
  });

  test("displays correct placeholders using translation keys", () => {
    render(<TestWrapper />);

    const nameInput = screen.getByTestId("input-actionNameInput");
    const descriptionInput = screen.getByTestId("input-actionDescriptionInput");

    expect(nameInput).toHaveAttribute("placeholder", "environments.actions.eg_clicked_download");
    expect(descriptionInput).toHaveAttribute(
      "placeholder",
      "environments.actions.user_clicked_download_button"
    );
  });

  test("renders with custom input IDs", () => {
    render(<TestWrapper nameInputId="customNameId" descriptionInputId="customDescriptionId" />);

    expect(screen.getByTestId("input-customNameId")).toBeInTheDocument();
    expect(screen.getByTestId("input-customDescriptionId")).toBeInTheDocument();
  });

  test("renders inputs as disabled when isReadOnly is true", () => {
    render(<TestWrapper isReadOnly={true} />);

    const nameInput = screen.getByTestId("input-actionNameInput");
    const descriptionInput = screen.getByTestId("input-actionDescriptionInput");

    expect(nameInput).toBeDisabled();
    expect(descriptionInput).toBeDisabled();
  });

  test("renders inputs as enabled when isReadOnly is false", () => {
    render(<TestWrapper isReadOnly={false} />);

    const nameInput = screen.getByTestId("input-actionNameInput");
    const descriptionInput = screen.getByTestId("input-actionDescriptionInput");

    expect(nameInput).not.toBeDisabled();
    expect(descriptionInput).not.toBeDisabled();
  });

  test("shows separator when showSeparator is true", () => {
    render(<TestWrapper showSeparator={true} />);

    const separator = screen.getByRole("separator");
    expect(separator).toBeInTheDocument();
    expect(separator).toHaveClass("border-slate-200");
  });

  test("renders form structure correctly with two columns", () => {
    render(<TestWrapper />);

    const nameFormItem = screen.getAllByTestId("form-item")[0];
    const descriptionFormItem = screen.getAllByTestId("form-item")[1];

    expect(nameFormItem).toBeInTheDocument();
    expect(descriptionFormItem).toBeInTheDocument();
  });

  test("renders form labels correctly", () => {
    render(<TestWrapper />);

    expect(screen.getAllByTestId("form-label")).toHaveLength(2);
    expect(screen.getByText("environments.actions.what_did_your_user_do")).toBeInTheDocument();
    expect(screen.getByText("common.description")).toBeInTheDocument();
  });

  test("renders form controls and items correctly", () => {
    render(<TestWrapper />);

    expect(screen.getAllByTestId("form-control")).toHaveLength(2);
    expect(screen.getAllByTestId("form-item")).toHaveLength(2);
  });

  test("renders with default prop values", () => {
    render(<TestWrapperDefault />);

    expect(screen.getByTestId("input-actionNameInput")).toBeInTheDocument();
    expect(screen.getByTestId("input-actionDescriptionInput")).toBeInTheDocument();
  });

  test("handles user interactions with name field", async () => {
    const user = userEvent.setup();
    render(<TestWrapper />);

    const nameInput = screen.getByTestId("input-actionNameInput");
    await user.click(nameInput);

    expect(nameInput).toBeInTheDocument();
  });

  test("handles user interactions with description field", async () => {
    const user = userEvent.setup();
    render(<TestWrapper />);

    const descriptionInput = screen.getByTestId("input-actionDescriptionInput");
    await user.click(descriptionInput);

    expect(descriptionInput).toBeInTheDocument();
  });

  test("description field handles empty value correctly", () => {
    render(<TestWrapper />);

    const descriptionInput = screen.getByTestId("input-actionDescriptionInput");
    expect(descriptionInput).toHaveAttribute("value", "");
  });
});
