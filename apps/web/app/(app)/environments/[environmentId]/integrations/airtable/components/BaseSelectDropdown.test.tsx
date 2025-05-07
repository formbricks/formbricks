import { cleanup, render, screen } from "@testing-library/react";
import { useForm } from "react-hook-form";
import { afterEach, describe, expect, test, vi } from "vitest";
import { TIntegrationItem } from "@formbricks/types/integration";
import { IntegrationModalInputs } from "./AddIntegrationModal";
import { BaseSelectDropdown } from "./BaseSelectDropdown";

// Mock UI components
vi.mock("@/modules/ui/components/label", () => ({
  Label: ({ children, htmlFor }: { children: React.ReactNode; htmlFor: string }) => (
    <label htmlFor={htmlFor}>{children}</label>
  ),
}));
vi.mock("@/modules/ui/components/select", () => ({
  Select: ({ children, onValueChange, disabled, defaultValue }) => (
    <select
      data-testid="base-select"
      onChange={(e) => onValueChange(e.target.value)}
      disabled={disabled}
      defaultValue={defaultValue}>
      {children}
    </select>
  ),
  SelectTrigger: ({ children }) => <div>{children}</div>,
  SelectValue: () => <span>SelectValueMock</span>,
  SelectContent: ({ children }) => <div>{children}</div>,
  SelectItem: ({ children, value }) => <option value={value}>{children}</option>,
}));

// Mock react-hook-form's Controller specifically
vi.mock("react-hook-form", async () => {
  const actual = await vi.importActual("react-hook-form");
  // Keep the actual useForm
  const originalUseForm = actual.useForm;

  // Mock Controller
  const MockController = ({ name, _, render, defaultValue }) => {
    // Minimal mock: call render with a basic field object
    const field = {
      onChange: vi.fn(), // Simple spy for field.onChange
      onBlur: vi.fn(),
      value: defaultValue, // Use defaultValue passed to Controller
      name: name,
      ref: vi.fn(),
    };
    // The component passes the render prop result to the actual Select component
    return render({ field });
  };

  return {
    ...actual,
    useForm: originalUseForm, // Use the actual useForm
    Controller: MockController, // Use the mocked Controller
  };
});

const mockAirtableArray: TIntegrationItem[] = [
  { id: "base1", name: "Base One" },
  { id: "base2", name: "Base Two" },
];

const mockFetchTable = vi.fn();

// Use a wrapper component that utilizes the actual useForm
const renderComponent = (
  isLoading = false,
  defaultValue: string | undefined = undefined,
  airtableArray = mockAirtableArray
) => {
  const Component = () => {
    // Now uses the actual useForm because Controller is mocked separately
    const { control, setValue } = useForm<IntegrationModalInputs>({
      defaultValues: { base: defaultValue },
    });
    return (
      <BaseSelectDropdown
        control={control}
        isLoading={isLoading}
        fetchTable={mockFetchTable} // The spy
        airtableArray={airtableArray}
        setValue={setValue} // Actual RHF setValue
        defaultValue={defaultValue}
      />
    );
  };
  return render(<Component />);
};

describe("BaseSelectDropdown", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  test("renders the label and select trigger", () => {
    renderComponent();
    expect(screen.getByText("environments.integrations.airtable.airtable_base")).toBeInTheDocument();
    expect(screen.getByTestId("base-select")).toBeInTheDocument();
    expect(screen.getByText("SelectValueMock")).toBeInTheDocument(); // From mocked SelectValue
  });

  test("renders options from airtableArray", () => {
    renderComponent();
    const select = screen.getByTestId("base-select");
    expect(select.querySelectorAll("option")).toHaveLength(mockAirtableArray.length);
    expect(screen.getByText("Base One")).toBeInTheDocument();
    expect(screen.getByText("Base Two")).toBeInTheDocument();
  });

  test("disables the select when isLoading is true", () => {
    renderComponent(true);
    expect(screen.getByTestId("base-select")).toBeDisabled();
  });

  test("enables the select when isLoading is false", () => {
    renderComponent(false);
    expect(screen.getByTestId("base-select")).toBeEnabled();
  });

  test("renders correctly with empty airtableArray", () => {
    renderComponent(false, undefined, []);
    const select = screen.getByTestId("base-select");
    expect(select.querySelectorAll("option")).toHaveLength(0);
  });
});
