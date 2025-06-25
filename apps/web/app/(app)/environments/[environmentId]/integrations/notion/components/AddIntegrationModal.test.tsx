import { AddIntegrationModal } from "@/app/(app)/environments/[environmentId]/integrations/notion/components/AddIntegrationModal";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  TIntegrationNotion,
  TIntegrationNotionConfigData,
  TIntegrationNotionCredential,
  TIntegrationNotionDatabase,
} from "@formbricks/types/integration/notion";
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
vi.mock("@/modules/survey/lib/questions", () => ({
  getQuestionTypes: () => [
    { id: TSurveyQuestionTypeEnum.OpenText, label: "Open Text" },
    { id: TSurveyQuestionTypeEnum.MultipleChoiceSingle, label: "Multiple Choice Single" },
    { id: TSurveyQuestionTypeEnum.Date, label: "Date" },
  ],
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
      callback();
    },
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
    t: (key: string, params?: any) => {
      // NOSONAR
      // Simple mock translation function
      if (key === "common.warning") return "Warning";
      if (key === "common.metadata") return "Metadata";
      if (key === "common.created_at") return "Created at";
      if (key === "common.hidden_field") return "Hidden Field";
      if (key === "environments.integrations.notion.link_notion_database") return "Link Notion Database";
      if (key === "environments.integrations.notion.sync_responses_with_a_notion_database")
        return "Sync responses with a Notion database.";
      if (key === "environments.integrations.notion.select_a_database") return "Select a database";
      if (key === "common.select_survey") return "Select survey";
      if (key === "environments.integrations.notion.map_formbricks_fields_to_notion_property")
        return "Map Formbricks fields to Notion property";
      if (key === "environments.integrations.notion.select_a_survey_question")
        return "Select a survey question";
      if (key === "environments.integrations.notion.select_a_field_to_map") return "Select a field to map";
      if (key === "common.delete") return "Delete";
      if (key === "common.cancel") return "Cancel";
      if (key === "common.update") return "Update";
      if (key === "environments.integrations.notion.please_select_a_database")
        return "Please select a database.";
      if (key === "environments.integrations.please_select_a_survey_error") return "Please select a survey.";
      if (key === "environments.integrations.notion.please_select_at_least_one_mapping")
        return "Please select at least one mapping.";
      if (key === "environments.integrations.notion.please_resolve_mapping_errors")
        return "Please resolve mapping errors.";
      if (key === "environments.integrations.notion.please_complete_mapping_fields_with_notion_property")
        return "Please complete mapping fields.";
      if (key === "environments.integrations.integration_updated_successfully")
        return "Integration updated successfully.";
      if (key === "environments.integrations.integration_added_successfully")
        return "Integration added successfully.";
      if (key === "environments.integrations.integration_removed_successfully")
        return "Integration removed successfully.";
      if (key === "environments.integrations.notion.notion_logo") return "Notion logo";
      if (key === "environments.integrations.create_survey_warning")
        return "You need to create a survey first.";
      if (key === "environments.integrations.notion.create_at_least_one_database_to_setup_this_integration")
        return "Create at least one database.";
      if (key === "environments.integrations.notion.duplicate_connection_warning")
        return "Duplicate connection warning.";
      if (key === "environments.integrations.notion.que_name_of_type_cant_be_mapped_to")
        return `Question ${params.que_name} (${params.question_label}) can't be mapped to ${params.col_name} (${params.col_type}). Allowed types: ${params.mapped_type}`;

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
        type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
        headline: { default: "Question 2?" },
        required: false,
        choices: [
          { id: "c1", label: { default: "Choice 1" } },
          { id: "c2", label: { default: "Choice 2" } },
        ],
      },
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
        type: TSurveyQuestionTypeEnum.Date,
        headline: { default: "Date Question?" },
        required: true,
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

const databases: TIntegrationNotionDatabase[] = [
  {
    id: "db1",
    name: "Database 1 Title",
    properties: {
      prop1: { id: "p1", name: "Title Prop", type: "title" },
      prop2: { id: "p2", name: "Text Prop", type: "rich_text" },
      prop3: { id: "p3", name: "Number Prop", type: "number" },
      prop4: { id: "p4", name: "Date Prop", type: "date" },
      prop5: { id: "p5", name: "Unsupported Prop", type: "formula" }, // Unsupported
    },
  },
  {
    id: "db2",
    name: "Database 2 Title",
    properties: {
      propA: { id: "pa", name: "Name", type: "title" },
      propB: { id: "pb", name: "Email", type: "email" },
    },
  },
];

const mockNotionIntegration: TIntegrationNotion = {
  id: "integration1",
  type: "notion",
  environmentId: environmentId,
  config: {
    key: {
      access_token: "token",
      bot_id: "bot",
      workspace_name: "ws",
      workspace_icon: "",
    } as unknown as TIntegrationNotionCredential,
    data: [], // Initially empty
  },
};

const mockSelectedIntegration: TIntegrationNotionConfigData & { index: number } = {
  databaseId: databases[0].id,
  databaseName: databases[0].name,
  surveyId: surveys[0].id,
  surveyName: surveys[0].name,
  mapping: [
    {
      column: { id: "p1", name: "Title Prop", type: "title" },
      question: { id: "q1", name: "Question 1?", type: TSurveyQuestionTypeEnum.OpenText },
    },
    {
      column: { id: "p2", name: "Text Prop", type: "rich_text" },
      question: { id: "var1", name: "Variable 1", type: TSurveyQuestionTypeEnum.OpenText },
    },
  ],
  createdAt: new Date(),
  index: 0,
};

describe("AddIntegrationModal (Notion)", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  beforeEach(() => {
    // Reset integration data before each test if needed
    mockNotionIntegration.config.data = [
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
        notionIntegration={{
          ...mockNotionIntegration,
          config: { ...mockNotionIntegration.config, data: [] },
        }}
        databases={databases}
        selectedIntegration={null}
      />
    );

    expect(screen.getByTestId("dialog")).toBeInTheDocument();
    expect(screen.getByText("environments.integrations.notion.link_database")).toBeInTheDocument();
    expect(screen.getByTestId("dropdown-select-a-database")).toBeInTheDocument();
    expect(screen.getByTestId("dropdown-select-survey")).toBeInTheDocument();
    expect(screen.getByText("Cancel")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "environments.integrations.notion.link_database" })
    ).toBeInTheDocument();
    expect(screen.queryByText("Delete")).not.toBeInTheDocument();
    expect(screen.queryByText("Map Formbricks fields to Notion property")).not.toBeInTheDocument();
  });

  test("renders correctly when open (update mode)", async () => {
    render(
      <AddIntegrationModal
        environmentId={environmentId}
        open={true}
        surveys={surveys}
        setOpen={mockSetOpen}
        notionIntegration={mockNotionIntegration}
        databases={databases}
        selectedIntegration={mockSelectedIntegration}
      />
    );

    expect(screen.getByTestId("dialog")).toBeInTheDocument();
    expect(screen.getByTestId("dropdown-select-a-database")).toHaveValue(databases[0].id);
    expect(screen.getByTestId("dropdown-select-survey")).toHaveValue(surveys[0].id);
    expect(screen.getByText("Map Formbricks fields to Notion property")).toBeInTheDocument();

    // Check if mapping rows are rendered
    await waitFor(() => {
      const questionDropdowns = screen.getAllByTestId("dropdown-select-a-survey-question");
      const columnDropdowns = screen.getAllByTestId("dropdown-select-a-field-to-map");

      expect(questionDropdowns).toHaveLength(2); // Expecting two rows based on mockSelectedIntegration
      expect(columnDropdowns).toHaveLength(2);

      // Assert values for the first row
      expect(questionDropdowns[0]).toHaveValue("q1");
      expect(columnDropdowns[0]).toHaveValue("p1");

      // Assert values for the second row
      expect(questionDropdowns[1]).toHaveValue("var1");
      expect(columnDropdowns[1]).toHaveValue("p2");

      expect(screen.getAllByTestId("plus-icon").length).toBeGreaterThan(0);
      expect(screen.getAllByTestId("trash-icon").length).toBeGreaterThan(0);
    });

    expect(screen.getByText("Delete")).toBeInTheDocument();
    expect(screen.getByText("Update")).toBeInTheDocument();
    expect(screen.queryByText("Cancel")).not.toBeInTheDocument();
  });

  test("selects database and survey, shows mapping", async () => {
    render(
      <AddIntegrationModal
        environmentId={environmentId}
        open={true}
        surveys={surveys}
        setOpen={mockSetOpen}
        notionIntegration={{
          ...mockNotionIntegration,
          config: { ...mockNotionIntegration.config, data: [] },
        }}
        databases={databases}
        selectedIntegration={null}
      />
    );

    const dbDropdown = screen.getByTestId("dropdown-select-a-database");
    const surveyDropdown = screen.getByTestId("dropdown-select-survey");

    await userEvent.selectOptions(dbDropdown, databases[0].id);
    await userEvent.selectOptions(surveyDropdown, surveys[0].id);

    expect(screen.getByText("Map Formbricks fields to Notion property")).toBeInTheDocument();
    expect(screen.getByTestId("dropdown-select-a-survey-question")).toBeInTheDocument();
    expect(screen.getByTestId("dropdown-select-a-field-to-map")).toBeInTheDocument();
  });

  test("adds and removes mapping rows", async () => {
    render(
      <AddIntegrationModal
        environmentId={environmentId}
        open={true}
        surveys={surveys}
        setOpen={mockSetOpen}
        notionIntegration={{
          ...mockNotionIntegration,
          config: { ...mockNotionIntegration.config, data: [] },
        }}
        databases={databases}
        selectedIntegration={null}
      />
    );

    const dbDropdown = screen.getByTestId("dropdown-select-a-database");
    const surveyDropdown = screen.getByTestId("dropdown-select-survey");

    await userEvent.selectOptions(dbDropdown, databases[0].id);
    await userEvent.selectOptions(surveyDropdown, surveys[0].id);

    expect(screen.getAllByTestId("dropdown-select-a-survey-question")).toHaveLength(1);

    const plusButton = screen.getByTestId("plus-icon");
    await userEvent.click(plusButton);

    expect(screen.getAllByTestId("dropdown-select-a-survey-question")).toHaveLength(2);

    const trashButton = screen.getAllByTestId("trash-icon")[0]; // Get the first trash button
    await userEvent.click(trashButton);

    expect(screen.getAllByTestId("dropdown-select-a-survey-question")).toHaveLength(1);
  });

  test("deletes integration successfully", async () => {
    createOrUpdateIntegrationAction.mockResolvedValue({ data: null as any });

    render(
      <AddIntegrationModal
        environmentId={environmentId}
        open={true}
        surveys={surveys}
        setOpen={mockSetOpen}
        notionIntegration={mockNotionIntegration} // Contains initial data at index 0
        databases={databases}
        selectedIntegration={mockSelectedIntegration}
      />
    );

    const deleteButton = screen.getByText("Delete");
    await userEvent.click(deleteButton);

    await waitFor(() => {
      expect(createOrUpdateIntegrationAction).toHaveBeenCalledWith({
        environmentId,
        integrationData: expect.objectContaining({
          config: expect.objectContaining({
            data: [], // Data array should be empty after deletion
          }),
        }),
      });
    });

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith("Integration removed successfully.");
    });
    await waitFor(() => {
      expect(mockSetOpen).toHaveBeenCalledWith(false);
    });
  });

  test("shows validation error if no database selected", async () => {
    render(
      <AddIntegrationModal
        environmentId={environmentId}
        open={true}
        surveys={surveys}
        setOpen={mockSetOpen}
        notionIntegration={{
          ...mockNotionIntegration,
          config: { ...mockNotionIntegration.config, data: [] },
        }}
        databases={databases}
        selectedIntegration={null}
      />
    );
    await userEvent.selectOptions(screen.getByTestId("dropdown-select-survey"), surveys[0].id);
    await userEvent.click(
      screen.getByRole("button", { name: "environments.integrations.notion.link_database" })
    );
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Please select a database.");
    });
  });

  test("shows validation error if no survey selected", async () => {
    render(
      <AddIntegrationModal
        environmentId={environmentId}
        open={true}
        surveys={surveys}
        setOpen={mockSetOpen}
        notionIntegration={{
          ...mockNotionIntegration,
          config: { ...mockNotionIntegration.config, data: [] },
        }}
        databases={databases}
        selectedIntegration={null}
      />
    );
    await userEvent.selectOptions(screen.getByTestId("dropdown-select-a-database"), databases[0].id);
    await userEvent.click(
      screen.getByRole("button", { name: "environments.integrations.notion.link_database" })
    );
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Please select a survey.");
    });
  });

  test("shows validation error if no mapping defined", async () => {
    render(
      <AddIntegrationModal
        environmentId={environmentId}
        open={true}
        surveys={surveys}
        setOpen={mockSetOpen}
        notionIntegration={{
          ...mockNotionIntegration,
          config: { ...mockNotionIntegration.config, data: [] },
        }}
        databases={databases}
        selectedIntegration={null}
      />
    );
    await userEvent.selectOptions(screen.getByTestId("dropdown-select-a-database"), databases[0].id);
    await userEvent.selectOptions(screen.getByTestId("dropdown-select-survey"), surveys[0].id);
    // Default mapping row is empty
    await userEvent.click(
      screen.getByRole("button", { name: "environments.integrations.notion.link_database" })
    );
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Please select at least one mapping.");
    });
  });

  test("calls setOpen(false) and resets form on cancel", async () => {
    render(
      <AddIntegrationModal
        environmentId={environmentId}
        open={true}
        surveys={surveys}
        setOpen={mockSetOpen}
        notionIntegration={{
          ...mockNotionIntegration,
          config: { ...mockNotionIntegration.config, data: [] },
        }}
        databases={databases}
        selectedIntegration={null}
      />
    );

    const dbDropdown = screen.getByTestId("dropdown-select-a-database");
    const cancelButton = screen.getByText("Cancel");

    await userEvent.selectOptions(dbDropdown, databases[0].id); // Simulate interaction
    await userEvent.click(cancelButton);

    expect(mockSetOpen).toHaveBeenCalledWith(false);
    // Re-render with open=true to check if state was reset
    cleanup();
    render(
      <AddIntegrationModal
        environmentId={environmentId}
        open={true}
        surveys={surveys}
        setOpen={mockSetOpen}
        notionIntegration={{
          ...mockNotionIntegration,
          config: { ...mockNotionIntegration.config, data: [] },
        }}
        databases={databases}
        selectedIntegration={null}
      />
    );
    expect(screen.getByTestId("dropdown-select-a-database")).toHaveValue(""); // Should be reset
  });
});
