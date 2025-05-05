import { createOrUpdateIntegrationAction } from "@/app/(app)/environments/[environmentId]/integrations/actions";
import { fetchTables } from "@/app/(app)/environments/[environmentId]/integrations/airtable/lib/airtable";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { TIntegrationItem } from "@formbricks/types/integration";
import {
  TIntegrationAirtable,
  TIntegrationAirtableConfigData,
  TIntegrationAirtableTables,
} from "@formbricks/types/integration/airtable";
import { TSurvey } from "@formbricks/types/surveys/types";
import { AddIntegrationModal } from "./AddIntegrationModal";

// Mock dependencies
vi.mock("@/app/(app)/environments/[environmentId]/integrations/actions", () => ({
  createOrUpdateIntegrationAction: vi.fn(),
}));
vi.mock(
  "@/app/(app)/environments/[environmentId]/integrations/airtable/components/BaseSelectDropdown",
  () => ({
    BaseSelectDropdown: ({ control, airtableArray, fetchTable, defaultValue, setValue }) => (
      <div>
        <label htmlFor="base">Base</label>
        <select
          id="base"
          defaultValue={defaultValue}
          onChange={(e) => {
            control._mockOnChange({ target: { name: "base", value: e.target.value } });
            setValue("table", ""); // Reset table when base changes
            fetchTable(e.target.value);
          }}>
          <option value="">Select Base</option>
          {airtableArray.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </div>
    ),
  })
);
vi.mock("@/app/(app)/environments/[environmentId]/integrations/airtable/lib/airtable", () => ({
  fetchTables: vi.fn(),
}));
vi.mock("@/lib/i18n/utils", () => ({
  getLocalizedValue: (value, _locale) => value?.default || value || "",
}));
vi.mock("@/lib/utils/recall", () => ({
  replaceHeadlineRecall: (survey, _locale) => survey,
}));
vi.mock("@/modules/ui/components/additional-integration-settings", () => ({
  AdditionalIntegrationSettings: ({
    includeVariables,
    setIncludeVariables,
    includeHiddenFields,
    setIncludeHiddenFields,
    includeMetadata,
    setIncludeMetadata,
    includeCreatedAt,
    setIncludeCreatedAt,
  }) => (
    <div data-testid="additional-settings">
      <input
        type="checkbox"
        data-testid="include-variables"
        checked={includeVariables}
        onChange={(e) => setIncludeVariables(e.target.checked)}
      />
      <input
        type="checkbox"
        data-testid="include-hidden"
        checked={includeHiddenFields}
        onChange={(e) => setIncludeHiddenFields(e.target.checked)}
      />
      <input
        type="checkbox"
        data-testid="include-metadata"
        checked={includeMetadata}
        onChange={(e) => setIncludeMetadata(e.target.checked)}
      />
      <input
        type="checkbox"
        data-testid="include-createdat"
        checked={includeCreatedAt}
        onChange={(e) => setIncludeCreatedAt(e.target.checked)}
      />
    </div>
  ),
}));
vi.mock("@/modules/ui/components/modal", () => ({
  Modal: ({ children, open, setOpen }) =>
    open ? (
      <div data-testid="modal">
        {children}
        <button onClick={() => setOpen(false)}>Close Modal</button>
      </div>
    ) : null,
}));
vi.mock("@/modules/ui/components/alert", () => ({
  Alert: ({ children }) => <div data-testid="alert">{children}</div>,
  AlertTitle: ({ children }) => <div data-testid="alert-title">{children}</div>,
  AlertDescription: ({ children }) => <div data-testid="alert-description">{children}</div>,
}));
vi.mock("next/image", () => ({
  // eslint-disable-next-line @next/next/no-img-element
  default: (props) => <img alt="test" {...props} />,
}));
vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({ refresh: vi.fn() })),
}));

// Mock the Select component used for Table and Survey selections
vi.mock("@/modules/ui/components/select", () => ({
  Select: ({ children, onValueChange, defaultValue, disabled, required }) => (
    // Render children, assuming Controller passes props to the Trigger/Value
    // The actual select logic will be handled by the mocked Controller/field
    // We need to simulate the structure expected by the Controller render prop
    <div>{children}</div>
  ),
  SelectTrigger: ({ children, ...props }) => <div {...props}>{children}</div>, // Mock Trigger
  SelectValue: ({ placeholder }) => <span>{placeholder || "Select..."}</span>, // Mock Value display
  SelectContent: ({ children }) => <div>{children}</div>, // Mock Content wrapper
  SelectItem: ({ children, value, ...props }) => (
    // Mock Item - crucial for userEvent.selectOptions if we were using a real select
    // For Controller, the value change is handled by field.onChange directly
    <div data-value={value} {...props}>
      {children}
    </div>
  ),
}));

// Mock react-hook-form Controller to render a simple select
vi.mock("react-hook-form", async () => {
  const actual = await vi.importActual("react-hook-form");
  let fields = {};
  const mockReset = vi.fn((values) => {
    fields = values || {}; // Reset fields, optionally with new values
  });

  return {
    ...actual,
    useForm: vi.fn((options) => {
      fields = options?.defaultValues || {};
      const mockControlOnChange = (event) => {
        if (event && event.target) {
          fields[event.target.name] = event.target.value;
        }
      };
      return {
        handleSubmit: (fn) => (e) => {
          e?.preventDefault();
          fn(fields);
        },
        control: {
          _mockOnChange: mockControlOnChange,
          // Add other necessary control properties if needed
          register: vi.fn(),
          unregister: vi.fn(),
          getFieldState: vi.fn(() => ({ invalid: false, isDirty: false, isTouched: false, error: null })),
          _names: { mount: new Set(), unMount: new Set(), array: new Set(), watch: new Set() },
          _options: {},
          _proxyFormState: {
            isDirty: false,
            isValidating: false,
            dirtyFields: {},
            touchedFields: {},
            errors: {},
          },
          _formState: { isDirty: false, isValidating: false, dirtyFields: {}, touchedFields: {}, errors: {} },
          _updateFormState: vi.fn(),
          _updateFieldArray: vi.fn(),
          _executeSchema: vi.fn().mockResolvedValue({ errors: {}, values: {} }),
          _getWatch: vi.fn(),
          _subjects: {
            watch: { subscribe: vi.fn() },
            array: { subscribe: vi.fn() },
            state: { subscribe: vi.fn() },
          },
          _getDirty: vi.fn(),
          _reset: vi.fn(),
          _removeUnmounted: vi.fn(),
        },
        watch: (name) => fields[name],
        setValue: (name, value, config) => {
          fields[name] = value;
        },
        reset: mockReset,
        formState: { errors: {}, isDirty: false, isValid: true, isSubmitting: false },
        getValues: (name) => (name ? fields[name] : fields),
      };
    }),
    Controller: ({ name, defaultValue, render, control }) => {
      // Initialize field value if not already set by reset/defaultValues
      if (fields[name] === undefined && defaultValue !== undefined) {
        fields[name] = defaultValue;
      }

      const field = {
        onChange: (valueOrEvent) => {
          const value = valueOrEvent?.target ? valueOrEvent.target.value : valueOrEvent;
          fields[name] = value;
          // Re-render might be needed here in a real scenario, but testing library handles it
        },
        onBlur: vi.fn(),
        value: fields[name],
        name: name,
        ref: vi.fn(),
      };

      // Find the corresponding label to associate with the select
      const labelId = name; // Assuming label 'for' matches field name
      const labelText =
        name === "table" ? "environments.integrations.airtable.table_name" : "common.select_survey";

      // Render a simple select element instead of the complex component
      // This makes interaction straightforward with userEvent.selectOptions
      return (
        <>
          {/* The actual label is rendered outside the Controller in the component */}
          <select
            id={labelId}
            aria-label={labelText} // Use aria-label for accessibility in tests
            {...field} // Spread field props
            defaultValue={defaultValue} // Pass defaultValue
          >
            {/* Need to dynamically get options based on context, simplified here */}
            {name === "table" &&
              mockTables.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            {name === "survey" &&
              mockSurveys.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
          </select>
        </>
      );
    },
    reset: mockReset,
  };
});

const environmentId = "test-env-id";
const mockSurveys: TSurvey[] = [
  {
    id: "survey1",
    name: "Survey 1",
    questions: [
      { id: "q1", headline: { default: "Question 1" } },
      { id: "q2", headline: { default: "Question 2" } },
    ],
    hiddenFields: { enabled: true, fieldIds: ["hf1"] },
    variables: { enabled: true, fieldIds: ["var1"] },
  } as any,
  {
    id: "survey2",
    name: "Survey 2",
    questions: [{ id: "q3", headline: { default: "Question 3" } }],
    hiddenFields: { enabled: false },
    variables: { enabled: false },
  } as any,
];
const mockAirtableArray: TIntegrationItem[] = [
  { id: "base1", name: "Base 1", type: "airtable" },
  { id: "base2", name: "Base 2", type: "airtable" },
];
const mockAirtableIntegration: TIntegrationAirtable = {
  id: "integration1",
  type: "airtable",
  environmentId,
  config: {
    key: { access_token: "abc" },
    email: "test@test.com",
    data: [],
  },
};
const mockTables: TIntegrationAirtableTables["tables"] = [
  { id: "table1", name: "Table 1" },
  { id: "table2", name: "Table 2" },
];
const mockSetOpenWithStates = vi.fn();
const mockRouterRefresh = vi.fn();

describe("AddIntegrationModal", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.mocked(useRouter).mockReturnValue({ refresh: mockRouterRefresh } as any);
    // Reset form fields before each test
    const { reset } = await import("react-hook-form");
    reset();
  });

  afterEach(() => {
    cleanup();
  });

  test("renders in add mode correctly", () => {
    render(
      <AddIntegrationModal
        open={true}
        setOpenWithStates={mockSetOpenWithStates}
        environmentId={environmentId}
        airtableArray={mockAirtableArray}
        surveys={mockSurveys}
        airtableIntegration={mockAirtableIntegration}
        isEditMode={false}
      />
    );

    expect(screen.getByText("environments.integrations.airtable.link_airtable_table")).toBeInTheDocument();
    expect(screen.getByLabelText("Base")).toBeInTheDocument();
    // Use getByLabelText for the mocked selects
    expect(screen.getByLabelText("environments.integrations.airtable.table_name")).toBeInTheDocument();
    expect(screen.getByLabelText("common.select_survey")).toBeInTheDocument();
    expect(screen.getByText("common.save")).toBeInTheDocument();
    expect(screen.getByText("common.cancel")).toBeInTheDocument();
    expect(screen.queryByText("common.delete")).not.toBeInTheDocument();
  });

  test("shows 'No Base Found' error when airtableArray is empty", () => {
    render(
      <AddIntegrationModal
        open={true}
        setOpenWithStates={mockSetOpenWithStates}
        environmentId={environmentId}
        airtableArray={[]}
        surveys={mockSurveys}
        airtableIntegration={mockAirtableIntegration}
        isEditMode={false}
      />
    );
    expect(screen.getByTestId("alert-title")).toHaveTextContent(
      "environments.integrations.airtable.no_bases_found"
    );
  });

  test("shows 'No Surveys Found' warning when surveys array is empty", () => {
    render(
      <AddIntegrationModal
        open={true}
        setOpenWithStates={mockSetOpenWithStates}
        environmentId={environmentId}
        airtableArray={mockAirtableArray}
        surveys={[]}
        airtableIntegration={mockAirtableIntegration}
        isEditMode={false}
      />
    );
    expect(screen.getByText("environments.integrations.create_survey_warning")).toBeInTheDocument();
  });

  test("fetches and displays tables when a base is selected", async () => {
    vi.mocked(fetchTables).mockResolvedValue({ tables: mockTables });
    render(
      <AddIntegrationModal
        open={true}
        setOpenWithStates={mockSetOpenWithStates}
        environmentId={environmentId}
        airtableArray={mockAirtableArray}
        surveys={mockSurveys}
        airtableIntegration={mockAirtableIntegration}
        isEditMode={false}
      />
    );

    const baseSelect = screen.getByLabelText("Base");
    await userEvent.selectOptions(baseSelect, "base1");

    expect(fetchTables).toHaveBeenCalledWith(environmentId, "base1");
    await waitFor(() => {
      // Use getByLabelText (mocked select)
      const tableSelect = screen.getByLabelText("environments.integrations.airtable.table_name");
      expect(tableSelect).toBeEnabled();
      // Check options within the mocked select
      expect(tableSelect.querySelector("option[value='table1']")).toBeInTheDocument();
      expect(tableSelect.querySelector("option[value='table2']")).toBeInTheDocument();
    });
  });

  test("handles deletion in edit mode", async () => {
    const initialData: TIntegrationAirtableConfigData = {
      baseId: "base1",
      tableId: "table1",
      surveyId: "survey1",
      questionIds: ["q1"],
      questions: "common.selected_questions",
      tableName: "Table 1",
      surveyName: "Survey 1",
      createdAt: new Date(),
      includeVariables: false,
      includeHiddenFields: false,
      includeMetadata: false,
      includeCreatedAt: true,
    };
    const integrationWithData = {
      ...mockAirtableIntegration,
      config: { ...mockAirtableIntegration.config, data: [initialData] },
    };
    const defaultData = { ...initialData, index: 0 };

    vi.mocked(fetchTables).mockResolvedValue({ tables: mockTables });
    vi.mocked(createOrUpdateIntegrationAction).mockResolvedValue({ ok: true, data: {} } as any);

    render(
      <AddIntegrationModal
        open={true}
        setOpenWithStates={mockSetOpenWithStates}
        environmentId={environmentId}
        airtableArray={mockAirtableArray}
        surveys={mockSurveys}
        airtableIntegration={integrationWithData}
        isEditMode={true}
        defaultData={defaultData}
      />
    );

    await waitFor(() => expect(fetchTables).toHaveBeenCalled()); // Wait for initial load

    // Click delete
    await userEvent.click(screen.getByText("common.delete"));

    await waitFor(() => {
      expect(createOrUpdateIntegrationAction).toHaveBeenCalledTimes(1);
      const submittedData = vi.mocked(createOrUpdateIntegrationAction).mock.calls[0][0].integrationData;
      // Expect data array to be empty after deletion
      expect(submittedData.config.data).toHaveLength(0);
    });

    expect(toast.success).toHaveBeenCalledWith("environments.integrations.integration_removed_successfully");
    expect(mockSetOpenWithStates).toHaveBeenCalledWith(false);
    expect(mockRouterRefresh).toHaveBeenCalled();
  });

  test("handles cancel button click", async () => {
    const { reset } = await import("react-hook-form");
    render(
      <AddIntegrationModal
        open={true}
        setOpenWithStates={mockSetOpenWithStates}
        environmentId={environmentId}
        airtableArray={mockAirtableArray}
        surveys={mockSurveys}
        airtableIntegration={mockAirtableIntegration}
        isEditMode={false}
      />
    );

    await userEvent.click(screen.getByText("common.cancel"));

    expect(reset).toHaveBeenCalled();
    expect(mockSetOpenWithStates).toHaveBeenCalledWith(false);
  });
});
