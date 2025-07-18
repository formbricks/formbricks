import { AddIntegrationModal } from "@/app/(app)/environments/[environmentId]/integrations/plain/components/AddIntegrationModal";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  TIntegrationPlain,
  TIntegrationPlainConfigData,
  TPlainFieldType,
} from "@formbricks/types/integration/plain";
import { TSurvey, TSurveyQuestion, TSurveyQuestionTypeEnum } from "@formbricks/types/surveys/types";

// Mock actions and utilities
vi.mock("@/app/(app)/environments/[environmentId]/integrations/actions", () => ({
  createOrUpdateIntegrationAction: vi.fn(),
}));
vi.mock("@/lib/i18n/utils", () => ({
  getLocalizedValue: (value: any, _locale: string) => value?.default || "",
}));
vi.mock("@/lib/pollyfills/structuredClone", () => ({
  structuredClone: (obj: any) => JSON.parse(JSON.stringify(obj)),
}));
vi.mock("@/lib/utils/recall", () => ({
  replaceHeadlineRecall: (survey: any) => survey,
}));
vi.mock("@/modules/ui/components/button", () => ({
  Button: ({ children, onClick, loading, variant, type = "button" }: any) => (
    <button onClick={onClick} disabled={loading} data-variant={variant} type={type}>
      {loading ? "Loading..." : children}
    </button>
  ),
}));
vi.mock("@/modules/ui/components/dropdown-selector", () => ({
  DropdownSelector: ({ label, items, selectedItem, setSelectedItem, placeholder, disabled }: any) => {
    // Ensure the selected item is always available as an option
    const allOptions = [...items];
    if (selectedItem && !items.some((item: any) => item.id === selectedItem.id)) {
      // Use a simple object structure consistent with how options are likely used
      allOptions.push({ id: selectedItem.id, name: selectedItem.name });
    }
    // Remove duplicates just in case
    const uniqueOptions = Array.from(new Map(allOptions.map((item) => [item.id, item])).values());

    return (
      <div>
        {label && <label>{label}</label>}
        <select
          data-testid={`dropdown-${label?.toLowerCase().replace(/\s+/g, "-") || placeholder?.toLowerCase().replace(/\s+/g, "-")}`}
          value={selectedItem?.id || ""} // Still set value based on selectedItem prop
          onChange={(e) => {
            const selected = uniqueOptions.find((item: any) => item.id === e.target.value);
            setSelectedItem(selected);
          }}
          disabled={disabled}>
          <option value="">{placeholder || "Select..."}</option>
          {/* Render options from the potentially augmented list */}
          {uniqueOptions.map((item: any) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </div>
    );
  },
}));
vi.mock("@/modules/ui/components/label", () => ({
  Label: ({ children }: { children: React.ReactNode }) => <label>{children}</label>,
}));
vi.mock("@/modules/ui/components/dialog", () => ({
  Dialog: ({ open, children }: { open: boolean; children: React.ReactNode }) =>
    open ? <div data-testid="dialog">{children}</div> : null,
  DialogContent: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="dialog-content" className={className}>
      {children}
    </div>
  ),
  DialogHeader: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="dialog-header" className={className}>
      {children}
    </div>
  ),
  DialogDescription: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <p data-testid="dialog-description" className={className}>
      {children}
    </p>
  ),
  DialogTitle: ({ children }: { children: React.ReactNode }) => (
    <h2 data-testid="dialog-title">{children}</h2>
  ),
  DialogBody: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="dialog-body" className={className}>
      {children}
    </div>
  ),
  DialogFooter: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="dialog-footer" className={className}>
      {children}
    </div>
  ),
}));
vi.mock("lucide-react", () => ({
  PlusIcon: () => <span data-testid="plus-icon">+</span>,
  TrashIcon: () => <span data-testid="trash-icon">🗑️</span>,
}));
vi.mock("next/image", () => ({
  // eslint-disable-next-line @next/next/no-img-element
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}));
vi.mock("react-hook-form", () => ({
  useForm: () => ({
    handleSubmit: (callback: any) => (event: any) => {
      event.preventDefault();
      return callback();
    },
    register: vi.fn(),
    setValue: vi.fn(),
    watch: vi.fn(),
    formState: { errors: {} },
  }),
}));
vi.mock("react-hot-toast", () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));
vi.mock("@tolgee/react", async () => {
  const MockTolgeeProvider = ({ children }: { children: React.ReactNode }) => <>{children}</>;
  const useTranslate = () => ({
    t: (key: string) => {
      // Simple mock translation function
      if (key === "common.warning") return "Warning";
      if (key === "common.metadata") return "Metadata";
      if (key === "common.created_at") return "Created at";
      if (key === "common.hidden_field") return "Hidden Field";
      if (key === "common.first_name") return "First Name";
      if (key === "common.last_name") return "Last Name";
      if (key === "common.email") return "Email";
      if (key === "common.select_survey") return "Select survey";
      if (key === "common.delete") return "Delete";
      if (key === "common.cancel") return "Cancel";
      if (key === "common.update") return "Update";
      if (key === "environments.integrations.plain.configure_plain_integration")
        return "Configure Plain Integration";
      if (key === "environments.integrations.plain.plain_integration_description")
        return "Connect your Plain account to send survey responses as threads.";
      if (key === "environments.integrations.plain.plain_logo") return "Plain logo";
      if (key === "environments.integrations.plain.map_formbricks_fields_to_plain")
        return "Map Formbricks fields to Plain";
      if (key === "environments.integrations.plain.select_a_survey_question")
        return "Select a survey question";
      if (key === "environments.integrations.plain.select_a_field_to_map") return "Select a field to map";
      if (key === "environments.integrations.plain.enter_label_id") return "Enter Label ID";
      if (key === "environments.integrations.plain.connect") return "Connect";
      if (key === "environments.integrations.plain.no_contact_info_question")
        return "No contact info question found in survey";
      if (key === "environments.integrations.plain.contact_info_missing_fields")
        return "Contact info question is missing required fields:";
      if (key === "environments.integrations.plain.contact_info_warning") return "Contact Info Warning";
      if (key === "environments.integrations.plain.contact_info_missing_fields_description")
        return "The following fields are missing";
      if (key === "environments.integrations.plain.please_select_at_least_one_mapping")
        return "Please select at least one mapping.";
      if (key === "environments.integrations.plain.please_resolve_mapping_errors")
        return "Please resolve mapping errors.";
      if (key === "environments.integrations.plain.please_complete_mapping_fields")
        return "Please complete mapping fields.";
      if (key === "environments.integrations.please_select_a_survey_error") return "Please select a survey.";
      if (key === "environments.integrations.create_survey_warning")
        return "You need to create a survey first.";
      if (key === "environments.integrations.integration_updated_successfully")
        return "Integration updated successfully.";
      if (key === "environments.integrations.integration_added_successfully")
        return "Integration added successfully.";
      if (key === "environments.integrations.integration_removed_successfully")
        return "Integration removed successfully.";

      return key; // Return key if no translation is found
    },
  });
  return { TolgeeProvider: MockTolgeeProvider, useTranslate };
});

// Mock dependencies
const createOrUpdateIntegrationAction = vi.mocked(
  (await import("@/app/(app)/environments/[environmentId]/integrations/actions"))
    .createOrUpdateIntegrationAction
);
const toast = vi.mocked((await import("react-hot-toast")).default);

const environmentId = "test-env-id";
const mockSetOpen = vi.fn();

// Create a mock survey with a ContactInfo question
const surveys: TSurvey[] = [
  {
    id: "survey1",
    createdAt: new Date(),
    updatedAt: new Date(),
    name: "Survey 1",
    type: "app",
    environmentId: environmentId,
    status: "inProgress",
    questions: [
      {
        id: "q1",
        type: TSurveyQuestionTypeEnum.OpenText,
        headline: { default: "Question 1?" },
        required: true,
      } as unknown as TSurveyQuestion,
      {
        id: "q2",
        type: TSurveyQuestionTypeEnum.ContactInfo,
        headline: { default: "Contact Info" },
        required: true,
        firstName: { show: true },
        lastName: { show: true },
        email: { show: true },
      } as unknown as TSurveyQuestion,
    ],
    variables: [{ id: "var1", name: "Variable 1" }],
    hiddenFields: { enabled: true, fieldIds: ["hf1"] },
    triggers: [],
    recontactDays: null,
    autoClose: null,
    closeOnDate: null,
    delay: 0,
    displayOption: "displayOnce",
    displayPercentage: null,
    autoComplete: null,
    singleUse: null,
    styling: null,
    surveyClosedMessage: null,
    segment: null,
    languages: [],
    welcomeCard: { enabled: true } as unknown as TSurvey["welcomeCard"],
    pin: null,
    resultShareKey: null,
    displayLimit: null,
  } as unknown as TSurvey,
  {
    id: "survey2",
    createdAt: new Date(),
    updatedAt: new Date(),
    name: "Survey 2",
    type: "link",
    environmentId: environmentId,
    status: "draft",
    questions: [
      {
        id: "q3",
        type: TSurveyQuestionTypeEnum.ContactInfo,
        headline: { default: "Partial Contact Info" },
        required: true,
        firstName: { show: true },
        lastName: { show: false }, // Missing lastName
        email: { show: true },
      } as unknown as TSurveyQuestion,
    ],
    variables: [],
    hiddenFields: { enabled: false },
    triggers: [],
    recontactDays: null,
    autoClose: null,
    closeOnDate: null,
    delay: 0,
    displayOption: "displayOnce",
    displayPercentage: null,
    autoComplete: null,
    singleUse: null,
    styling: null,
    surveyClosedMessage: null,
    segment: null,
    languages: [],
    welcomeCard: { enabled: true } as unknown as TSurvey["welcomeCard"],
    pin: null,
    resultShareKey: null,
    displayLimit: null,
  } as unknown as TSurvey,
];

const mockPlainIntegration: TIntegrationPlain = {
  id: "integration1",
  type: "plain",
  environmentId: environmentId,
  config: {
    key: "test-api-key",
    data: [], // Initially empty
  },
};

const mockSelectedIntegration: TIntegrationPlainConfigData & { index: number } = {
  surveyId: surveys[0].id,
  surveyName: surveys[0].name,
  mapping: [
    {
      plainField: { id: "threadTitle", name: "Thread Title", type: "title" as TPlainFieldType },
      question: { id: "q1", name: "Question 1?", type: TSurveyQuestionTypeEnum.OpenText },
    },
    {
      plainField: { id: "componentText", name: "Component Text", type: "componentText" as TPlainFieldType },
      question: { id: "var1", name: "Variable 1", type: TSurveyQuestionTypeEnum.OpenText },
    },
  ],
  includeCreatedAt: true,
  includeComponents: true,
  labelId: "custom-label",
  createdAt: new Date(),
  index: 0,
};

describe("AddIntegrationModal (Plain)", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  beforeEach(() => {
    // Reset integration data before each test if needed
    mockPlainIntegration.config.data = [
      { ...mockSelectedIntegration }, // Simulate existing data for update/delete tests
    ];
  });

  test("renders correctly when open (create mode)", () => {
    render(
      <AddIntegrationModal
        environmentId={environmentId}
        open={true}
        surveys={surveys}
        setOpen={mockSetOpen}
        plainIntegration={{
          ...mockPlainIntegration,
          config: { ...mockPlainIntegration.config, data: [] },
        }}
        selectedIntegration={null}
      />
    );

    expect(screen.getByTestId("dialog")).toBeInTheDocument();
    expect(screen.getByText("Configure Plain Integration")).toBeInTheDocument();
    expect(screen.getByTestId("dropdown-select-survey")).toBeInTheDocument();
    expect(screen.getByText("Cancel")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Connect" })).toBeInTheDocument();
    expect(screen.queryByText("Delete")).not.toBeInTheDocument();
  });

  test("renders correctly when open (update mode)", async () => {
    render(
      <AddIntegrationModal
        environmentId={environmentId}
        open={true}
        surveys={surveys}
        setOpen={mockSetOpen}
        plainIntegration={mockPlainIntegration}
        selectedIntegration={mockSelectedIntegration}
      />
    );

    expect(screen.getByTestId("dialog")).toBeInTheDocument();
    expect(screen.getByTestId("dropdown-select-survey")).toHaveValue(surveys[0].id);
    expect(screen.getByText("Map Formbricks fields to Plain")).toBeInTheDocument();

    // Check if mapping rows are rendered
    await waitFor(() => {
      const questionDropdowns = screen.getAllByTestId("dropdown-select-a-survey-question");
      expect(questionDropdowns).toHaveLength(2); // Expecting two rows based on mockSelectedIntegration
    });

    expect(screen.getByText("Delete")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Update" })).toBeInTheDocument();
  });

  test("shows survey selection and enables mapping when survey is selected", async () => {
    const user = userEvent.setup();

    render(
      <AddIntegrationModal
        environmentId={environmentId}
        open={true}
        surveys={surveys}
        setOpen={mockSetOpen}
        plainIntegration={{
          ...mockPlainIntegration,
          config: { ...mockPlainIntegration.config, data: [] },
        }}
        selectedIntegration={null}
      />
    );

    // Select a survey
    const surveyDropdown = screen.getByTestId("dropdown-select-survey");
    await user.selectOptions(surveyDropdown, surveys[0].id);

    // Check if mapping section appears
    expect(screen.getByText("Map Formbricks fields to Plain")).toBeInTheDocument();

    // Check if default mapping rows are present
    const questionDropdowns = screen.getAllByTestId("dropdown-select-a-survey-question");
    expect(questionDropdowns).toHaveLength(2); // Two default mapping rows
  });

  test("adds and removes mapping rows", async () => {
    const user = userEvent.setup();

    render(
      <AddIntegrationModal
        environmentId={environmentId}
        open={true}
        surveys={surveys}
        setOpen={mockSetOpen}
        plainIntegration={mockPlainIntegration}
        selectedIntegration={null}
      />
    );

    // Select a survey first
    const surveyDropdown = screen.getByTestId("dropdown-select-survey");
    await user.selectOptions(surveyDropdown, surveys[0].id);

    // Initial mapping rows
    let plusButtons = screen.getAllByTestId("plus-icon");
    expect(plusButtons).toHaveLength(2); // Two default rows

    // Add a new row
    await user.click(plusButtons[0]);

    // Check if a new row was added
    plusButtons = screen.getAllByTestId("plus-icon");
    expect(plusButtons).toHaveLength(3); // Now three rows

    // Try to remove a row (not the mandatory ones)
    const trashButtons = screen.getAllByTestId("trash-icon");
    expect(trashButtons).toHaveLength(1); // Only the new row should be removable

    await user.click(trashButtons[0]);

    // Check if row was removed
    plusButtons = screen.getAllByTestId("plus-icon");
    expect(plusButtons).toHaveLength(2); // Back to two rows
  });

  test("shows warning for survey with incomplete contact info", async () => {
    const user = userEvent.setup();

    render(
      <AddIntegrationModal
        environmentId={environmentId}
        open={true}
        surveys={surveys}
        setOpen={mockSetOpen}
        plainIntegration={mockPlainIntegration}
        selectedIntegration={null}
      />
    );

    // Select survey with incomplete contact info
    const surveyDropdown = screen.getByTestId("dropdown-select-survey");
    await user.selectOptions(surveyDropdown, surveys[1].id);

    // Check if warning appears
    expect(screen.getByText("Contact Info Warning")).toBeInTheDocument();
    expect(screen.getByText(/Last Name/)).toBeInTheDocument(); // Missing field
  });

  test("handles form submission with validation errors", async () => {
    const user = userEvent.setup();

    render(
      <AddIntegrationModal
        environmentId={environmentId}
        open={true}
        surveys={surveys}
        setOpen={mockSetOpen}
        plainIntegration={mockPlainIntegration}
        selectedIntegration={null}
      />
    );

    // Try to submit without selecting a survey
    const connectButton = screen.getByRole("button", { name: "Connect" });
    await user.click(connectButton);

    // Check if error toast was shown
    expect(toast.error).toHaveBeenCalledWith("Please select a survey.");
  });

  test("handles successful integration update", async () => {
    const user = userEvent.setup();
    createOrUpdateIntegrationAction.mockResolvedValue({});

    render(
      <AddIntegrationModal
        environmentId={environmentId}
        open={true}
        surveys={surveys}
        setOpen={mockSetOpen}
        plainIntegration={mockPlainIntegration}
        selectedIntegration={mockSelectedIntegration}
      />
    );

    // Change a mapping
    const questionDropdowns = screen.getAllByTestId("dropdown-select-a-survey-question");
    await user.selectOptions(questionDropdowns[0], "q2"); // Change to Contact Info question

    // Submit the form
    const updateButton = screen.getByRole("button", { name: "Update" });
    await user.click(updateButton);

    // Check if integration was updated
    await waitFor(() => {
      expect(createOrUpdateIntegrationAction).toHaveBeenCalled();
      expect(toast.success).toHaveBeenCalledWith("Integration updated successfully.");
      expect(mockSetOpen).toHaveBeenCalledWith(false);
    });
  });

  test("handles integration deletion", async () => {
    const user = userEvent.setup();
    createOrUpdateIntegrationAction.mockResolvedValue({});

    render(
      <AddIntegrationModal
        environmentId={environmentId}
        open={true}
        surveys={surveys}
        setOpen={mockSetOpen}
        plainIntegration={mockPlainIntegration}
        selectedIntegration={mockSelectedIntegration}
      />
    );

    // Click delete button
    const deleteButton = screen.getByRole("button", { name: "Delete" });
    await user.click(deleteButton);

    // Check if integration was deleted
    await waitFor(() => {
      expect(createOrUpdateIntegrationAction).toHaveBeenCalled();
      expect(toast.success).toHaveBeenCalledWith("Integration removed successfully.");
      expect(mockSetOpen).toHaveBeenCalledWith(false);
    });
  });

  test("calls setOpen(false) and resets form on cancel", async () => {
    const user = userEvent.setup();

    render(
      <AddIntegrationModal
        environmentId={environmentId}
        open={true}
        surveys={surveys}
        setOpen={mockSetOpen}
        plainIntegration={mockPlainIntegration}
        selectedIntegration={null}
      />
    );

    // Click cancel button
    const cancelButton = screen.getByRole("button", { name: "Cancel" });
    await user.click(cancelButton);

    // Check if modal was closed
    expect(mockSetOpen).toHaveBeenCalledWith(false);
  });
});
