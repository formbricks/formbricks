import { AddIntegrationModal } from "@/app/(app)/environments/[environmentId]/integrations/google-sheets/components/AddIntegrationModal";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { TEnvironment } from "@formbricks/types/environment";
import {
  TIntegrationGoogleSheets,
  TIntegrationGoogleSheetsConfigData,
} from "@formbricks/types/integration/google-sheet";
import { TSurvey, TSurveyQuestion, TSurveyQuestionTypeEnum } from "@formbricks/types/surveys/types";

// Mock actions and utilities
vi.mock("@/app/(app)/environments/[environmentId]/integrations/actions", () => ({
  createOrUpdateIntegrationAction: vi.fn(),
}));
vi.mock("@/app/(app)/environments/[environmentId]/integrations/google-sheets/actions", () => ({
  getSpreadsheetNameByIdAction: vi.fn(),
}));
vi.mock("@/app/(app)/environments/[environmentId]/integrations/google-sheets/lib/util", () => ({
  constructGoogleSheetsUrl: (id: string) => `https://docs.google.com/spreadsheets/d/${id}`,
  extractSpreadsheetIdFromUrl: (url: string) => url.split("/")[5],
  isValidGoogleSheetsUrl: (url: string) => url.startsWith("https://docs.google.com/spreadsheets/d/"),
}));
vi.mock("@/lib/i18n/utils", () => ({
  getLocalizedValue: (value: any, _locale: string) => value?.default || "",
}));
vi.mock("@/lib/utils/recall", () => ({
  replaceHeadlineRecall: (survey: any) => survey,
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
  }: any) => (
    <div>
      <span>Additional Settings</span>
      <input
        data-testid="include-variables"
        type="checkbox"
        checked={includeVariables}
        onChange={(e) => setIncludeVariables(e.target.checked)}
      />
      <input
        data-testid="include-hidden-fields"
        type="checkbox"
        checked={includeHiddenFields}
        onChange={(e) => setIncludeHiddenFields(e.target.checked)}
      />
      <input
        data-testid="include-metadata"
        type="checkbox"
        checked={includeMetadata}
        onChange={(e) => setIncludeMetadata(e.target.checked)}
      />
      <input
        data-testid="include-created-at"
        type="checkbox"
        checked={includeCreatedAt}
        onChange={(e) => setIncludeCreatedAt(e.target.checked)}
      />
    </div>
  ),
}));
vi.mock("@/modules/ui/components/dropdown-selector", () => ({
  DropdownSelector: ({ label, items, selectedItem, setSelectedItem }: any) => (
    <div>
      <label>{label}</label>
      <select
        data-testid="survey-dropdown"
        value={selectedItem?.id || ""}
        onChange={(e) => {
          const selected = items.find((item: any) => item.id === e.target.value);
          setSelectedItem(selected);
        }}>
        <option value="">Select a survey</option>
        {items.map((item: any) => (
          <option key={item.id} value={item.id}>
            {item.name}
          </option>
        ))}
      </select>
    </div>
  ),
}));
vi.mock("@/modules/ui/components/modal", () => ({
  Modal: ({ open, children }: { open: boolean; children: React.ReactNode }) =>
    open ? <div data-testid="modal">{children}</div> : null,
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
    t: (key: string, _?: any) => {
      // NOSONAR
      // Simple mock translation function
      if (key === "common.all_questions") return "All questions";
      if (key === "common.selected_questions") return "Selected questions";
      if (key === "environments.integrations.google_sheets.link_google_sheet") return "Link Google Sheet";
      if (key === "common.update") return "Update";
      if (key === "common.delete") return "Delete";
      if (key === "common.cancel") return "Cancel";
      if (key === "environments.integrations.google_sheets.spreadsheet_url") return "Spreadsheet URL";
      if (key === "common.select_survey") return "Select survey";
      if (key === "common.questions") return "Questions";
      if (key === "environments.integrations.google_sheets.enter_a_valid_spreadsheet_url_error")
        return "Please enter a valid Google Sheet URL.";
      if (key === "environments.integrations.please_select_a_survey_error") return "Please select a survey.";
      if (key === "environments.integrations.select_at_least_one_question_error")
        return "Please select at least one question.";
      if (key === "environments.integrations.integration_updated_successfully")
        return "Integration updated successfully.";
      if (key === "environments.integrations.integration_added_successfully")
        return "Integration added successfully.";
      if (key === "environments.integrations.integration_removed_successfully")
        return "Integration removed successfully.";
      if (key === "environments.integrations.google_sheets.google_sheet_logo") return "Google Sheet logo";
      if (key === "environments.integrations.google_sheets.google_sheets_integration_description")
        return "Sync responses with Google Sheets.";
      if (key === "environments.integrations.create_survey_warning")
        return "You need to create a survey first.";
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
const getSpreadsheetNameByIdAction = vi.mocked(
  (await import("@/app/(app)/environments/[environmentId]/integrations/google-sheets/actions"))
    .getSpreadsheetNameByIdAction
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
    variables: [],
    welcomeCard: { enabled: true } as unknown as TSurvey["welcomeCard"],
    hiddenFields: { enabled: true, fieldIds: [] },
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
        type: TSurveyQuestionTypeEnum.Rating,
        headline: { default: "Rate this?" },
        required: true,
        scale: "number",
        range: 5,
      } as unknown as TSurveyQuestion,
    ],
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
    variables: [],
    welcomeCard: { enabled: true } as unknown as TSurvey["welcomeCard"],
    hiddenFields: { enabled: true, fieldIds: [] },
    pin: null,
    resultShareKey: null,
    displayLimit: null,
  } as unknown as TSurvey,
];

const mockGoogleSheetIntegration = {
  id: "integration1",
  type: "googleSheets",
  config: {
    key: {
      access_token: "mock_access_token",
      expiry_date: Date.now() + 3600000,
      refresh_token: "mock_refresh_token",
      scope: "mock_scope",
      token_type: "Bearer",
    },
    email: "test@example.com",
    data: [], // Initially empty, will be populated in beforeEach
  },
} as unknown as TIntegrationGoogleSheets;

const mockSelectedIntegration: TIntegrationGoogleSheetsConfigData & { index: number } = {
  spreadsheetId: "existing-sheet-id",
  spreadsheetName: "Existing Sheet",
  surveyId: surveys[0].id,
  surveyName: surveys[0].name,
  questionIds: [surveys[0].questions[0].id],
  questions: "Selected questions",
  createdAt: new Date(),
  includeVariables: true,
  includeHiddenFields: false,
  includeMetadata: true,
  includeCreatedAt: false,
  index: 0,
};

describe("AddIntegrationModal", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  beforeEach(() => {
    // Reset integration data before each test if needed
    mockGoogleSheetIntegration.config.data = [
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
        googleSheetIntegration={mockGoogleSheetIntegration}
        selectedIntegration={null}
      />
    );

    expect(screen.getByTestId("modal")).toBeInTheDocument();
    expect(
      screen.getByText("Link Google Sheet", { selector: "div.text-xl.font-medium" })
    ).toBeInTheDocument();
    // Use getByPlaceholderText for the input
    expect(
      screen.getByPlaceholderText("https://docs.google.com/spreadsheets/d/<your-spreadsheet-id>")
    ).toBeInTheDocument();
    // Use getByTestId for the dropdown
    expect(screen.getByTestId("survey-dropdown")).toBeInTheDocument();
    expect(screen.getByText("Cancel")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Link Google Sheet" })).toBeInTheDocument();
    expect(screen.queryByText("Delete")).not.toBeInTheDocument();
    expect(screen.queryByText("Questions")).not.toBeInTheDocument();
  });

  test("renders correctly when open (update mode)", () => {
    render(
      <AddIntegrationModal
        environmentId={environmentId}
        open={true}
        surveys={surveys}
        setOpen={mockSetOpen}
        googleSheetIntegration={mockGoogleSheetIntegration}
        selectedIntegration={mockSelectedIntegration}
      />
    );

    expect(screen.getByTestId("modal")).toBeInTheDocument();
    expect(
      screen.getByText("Link Google Sheet", { selector: "div.text-xl.font-medium" })
    ).toBeInTheDocument();
    // Use getByPlaceholderText for the input
    expect(
      screen.getByPlaceholderText("https://docs.google.com/spreadsheets/d/<your-spreadsheet-id>")
    ).toHaveValue("https://docs.google.com/spreadsheets/d/existing-sheet-id");
    expect(screen.getByTestId("survey-dropdown")).toHaveValue(surveys[0].id);
    expect(screen.getByText("Questions")).toBeInTheDocument();
    expect(screen.getByText("Delete")).toBeInTheDocument();
    expect(screen.getByText("Update")).toBeInTheDocument();
    expect(screen.queryByText("Cancel")).not.toBeInTheDocument();
    expect(screen.getByTestId("include-variables")).toBeChecked();
    expect(screen.getByTestId("include-hidden-fields")).not.toBeChecked();
    expect(screen.getByTestId("include-metadata")).toBeChecked();
    expect(screen.getByTestId("include-created-at")).not.toBeChecked();
  });

  test("selects survey and shows questions", async () => {
    render(
      <AddIntegrationModal
        environmentId={environmentId}
        open={true}
        surveys={surveys}
        setOpen={mockSetOpen}
        googleSheetIntegration={mockGoogleSheetIntegration}
        selectedIntegration={null}
      />
    );

    const surveyDropdown = screen.getByTestId("survey-dropdown");
    await userEvent.selectOptions(surveyDropdown, surveys[1].id);

    expect(screen.getByText("Questions")).toBeInTheDocument();
    surveys[1].questions.forEach((q) => {
      expect(screen.getByLabelText(q.headline.default)).toBeInTheDocument();
      // Initially all questions should be checked when a survey is selected in create mode
      expect(screen.getByLabelText(q.headline.default)).toBeChecked();
    });
  });

  test("handles question selection", async () => {
    render(
      <AddIntegrationModal
        environmentId={environmentId}
        open={true}
        surveys={surveys}
        setOpen={mockSetOpen}
        googleSheetIntegration={mockGoogleSheetIntegration}
        selectedIntegration={null}
      />
    );

    const surveyDropdown = screen.getByTestId("survey-dropdown");
    await userEvent.selectOptions(surveyDropdown, surveys[0].id);

    const firstQuestionCheckbox = screen.getByLabelText(surveys[0].questions[0].headline.default);
    expect(firstQuestionCheckbox).toBeChecked(); // Initially checked

    await userEvent.click(firstQuestionCheckbox);
    expect(firstQuestionCheckbox).not.toBeChecked(); // Unchecked after click

    await userEvent.click(firstQuestionCheckbox);
    expect(firstQuestionCheckbox).toBeChecked(); // Checked again
  });

  test("creates integration successfully", async () => {
    getSpreadsheetNameByIdAction.mockResolvedValue({ data: "Test Sheet Name" });
    createOrUpdateIntegrationAction.mockResolvedValue({ data: null as any }); // Mock successful action

    render(
      <AddIntegrationModal
        environmentId={environmentId}
        open={true}
        surveys={surveys}
        setOpen={mockSetOpen}
        googleSheetIntegration={{
          ...mockGoogleSheetIntegration,
          config: { ...mockGoogleSheetIntegration.config, data: [] },
        }} // Start with empty data
        selectedIntegration={null}
      />
    );

    // Use getByPlaceholderText for the input
    const urlInput = screen.getByPlaceholderText(
      "https://docs.google.com/spreadsheets/d/<your-spreadsheet-id>"
    );
    const surveyDropdown = screen.getByTestId("survey-dropdown");
    const submitButton = screen.getByRole("button", { name: "Link Google Sheet" });

    await userEvent.type(urlInput, "https://docs.google.com/spreadsheets/d/new-sheet-id");
    await userEvent.selectOptions(surveyDropdown, surveys[0].id);

    // Wait for questions to appear and potentially uncheck one
    const firstQuestionCheckbox = await screen.findByLabelText(surveys[0].questions[0].headline.default);
    await userEvent.click(firstQuestionCheckbox); // Uncheck first question

    // Check additional settings
    await userEvent.click(screen.getByTestId("include-variables"));
    await userEvent.click(screen.getByTestId("include-metadata"));

    await userEvent.click(submitButton);

    await waitFor(() => {
      expect(getSpreadsheetNameByIdAction).toHaveBeenCalledWith({
        googleSheetIntegration: expect.any(Object),
        environmentId,
        spreadsheetId: "new-sheet-id",
      });
    });

    await waitFor(() => {
      expect(createOrUpdateIntegrationAction).toHaveBeenCalledWith({
        environmentId,
        integrationData: expect.objectContaining({
          type: "googleSheets",
          config: expect.objectContaining({
            key: mockGoogleSheetIntegration.config.key,
            email: mockGoogleSheetIntegration.config.email,
            data: expect.arrayContaining([
              expect.objectContaining({
                spreadsheetId: "new-sheet-id",
                spreadsheetName: "Test Sheet Name",
                surveyId: surveys[0].id,
                surveyName: surveys[0].name,
                questionIds: surveys[0].questions.slice(1).map((q) => q.id), // Excludes the first question
                questions: "Selected questions",
                includeVariables: true,
                includeHiddenFields: false,
                includeMetadata: true,
                includeCreatedAt: true, // Default
              }),
            ]),
          }),
        }),
      });
    });

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith("Integration added successfully.");
    });
    await waitFor(() => {
      expect(mockSetOpen).toHaveBeenCalledWith(false);
    });
  });

  test("deletes integration successfully", async () => {
    createOrUpdateIntegrationAction.mockResolvedValue({ data: null as any });

    render(
      <AddIntegrationModal
        environmentId={environmentId}
        open={true}
        surveys={surveys}
        setOpen={mockSetOpen}
        googleSheetIntegration={mockGoogleSheetIntegration} // Contains initial data at index 0
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

  test("shows validation error for invalid URL", async () => {
    render(
      <AddIntegrationModal
        environmentId={environmentId}
        open={true}
        surveys={surveys}
        setOpen={mockSetOpen}
        googleSheetIntegration={mockGoogleSheetIntegration}
        selectedIntegration={null}
      />
    );

    // Use getByPlaceholderText for the input
    const urlInput = screen.getByPlaceholderText(
      "https://docs.google.com/spreadsheets/d/<your-spreadsheet-id>"
    );
    const surveyDropdown = screen.getByTestId("survey-dropdown");
    const submitButton = screen.getByRole("button", { name: "Link Google Sheet" });

    await userEvent.type(urlInput, "invalid-url");
    await userEvent.selectOptions(surveyDropdown, surveys[0].id);
    await userEvent.click(submitButton);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Please enter a valid Google Sheet URL.");
    });
    expect(createOrUpdateIntegrationAction).not.toHaveBeenCalled();
    expect(mockSetOpen).not.toHaveBeenCalled();
  });

  test("shows validation error if no survey selected", async () => {
    render(
      <AddIntegrationModal
        environmentId={environmentId}
        open={true}
        surveys={surveys}
        setOpen={mockSetOpen}
        googleSheetIntegration={mockGoogleSheetIntegration}
        selectedIntegration={null}
      />
    );

    // Use getByPlaceholderText for the input
    const urlInput = screen.getByPlaceholderText(
      "https://docs.google.com/spreadsheets/d/<your-spreadsheet-id>"
    );
    const submitButton = screen.getByRole("button", { name: "Link Google Sheet" });

    await userEvent.type(urlInput, "https://docs.google.com/spreadsheets/d/some-id");
    // No survey selected
    await userEvent.click(submitButton);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Please select a survey.");
    });
    expect(createOrUpdateIntegrationAction).not.toHaveBeenCalled();
    expect(mockSetOpen).not.toHaveBeenCalled();
  });

  test("shows validation error if no questions selected", async () => {
    render(
      <AddIntegrationModal
        environmentId={environmentId}
        open={true}
        surveys={surveys}
        setOpen={mockSetOpen}
        googleSheetIntegration={mockGoogleSheetIntegration}
        selectedIntegration={null}
      />
    );

    // Use getByPlaceholderText for the input
    const urlInput = screen.getByPlaceholderText(
      "https://docs.google.com/spreadsheets/d/<your-spreadsheet-id>"
    );
    const surveyDropdown = screen.getByTestId("survey-dropdown");
    const submitButton = screen.getByRole("button", { name: "Link Google Sheet" });

    await userEvent.type(urlInput, "https://docs.google.com/spreadsheets/d/some-id");
    await userEvent.selectOptions(surveyDropdown, surveys[0].id);

    // Uncheck all questions
    for (const question of surveys[0].questions) {
      const checkbox = await screen.findByLabelText(question.headline.default);
      await userEvent.click(checkbox);
    }

    await userEvent.click(submitButton);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Please select at least one question.");
    });
    expect(createOrUpdateIntegrationAction).not.toHaveBeenCalled();
    expect(mockSetOpen).not.toHaveBeenCalled();
  });

  test("shows error toast if createOrUpdateIntegrationAction fails", async () => {
    const errorMessage = "Failed to update integration";
    getSpreadsheetNameByIdAction.mockResolvedValue({ data: "Some Sheet Name" });
    createOrUpdateIntegrationAction.mockRejectedValue(new Error(errorMessage));

    render(
      <AddIntegrationModal
        environmentId={environmentId}
        open={true}
        surveys={surveys}
        setOpen={mockSetOpen}
        googleSheetIntegration={mockGoogleSheetIntegration}
        selectedIntegration={null}
      />
    );

    // Use getByPlaceholderText for the input
    const urlInput = screen.getByPlaceholderText(
      "https://docs.google.com/spreadsheets/d/<your-spreadsheet-id>"
    );
    const surveyDropdown = screen.getByTestId("survey-dropdown");
    const submitButton = screen.getByRole("button", { name: "Link Google Sheet" });

    await userEvent.type(urlInput, "https://docs.google.com/spreadsheets/d/another-id");
    await userEvent.selectOptions(surveyDropdown, surveys[0].id);
    await userEvent.click(submitButton);

    await waitFor(() => {
      expect(getSpreadsheetNameByIdAction).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(createOrUpdateIntegrationAction).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(errorMessage);
    });
    expect(mockSetOpen).not.toHaveBeenCalled();
  });

  test("calls setOpen(false) and resets form on cancel", async () => {
    render(
      <AddIntegrationModal
        environmentId={environmentId}
        open={true}
        surveys={surveys}
        setOpen={mockSetOpen}
        googleSheetIntegration={mockGoogleSheetIntegration}
        selectedIntegration={null}
      />
    );

    // Use getByPlaceholderText for the input
    const urlInput = screen.getByPlaceholderText(
      "https://docs.google.com/spreadsheets/d/<your-spreadsheet-id>"
    );
    const cancelButton = screen.getByText("Cancel");

    // Simulate some interaction
    await userEvent.type(urlInput, "https://docs.google.com/spreadsheets/d/temp-id");
    await userEvent.click(cancelButton);

    expect(mockSetOpen).toHaveBeenCalledWith(false);
    // Re-render with open=true to check if state was reset (URL should be empty)
    cleanup();
    render(
      <AddIntegrationModal
        environmentId={environmentId}
        open={true}
        surveys={surveys}
        setOpen={mockSetOpen}
        googleSheetIntegration={mockGoogleSheetIntegration}
        selectedIntegration={null}
      />
    );
    // Use getByPlaceholderText for the input check after re-render
    expect(
      screen.getByPlaceholderText("https://docs.google.com/spreadsheets/d/<your-spreadsheet-id>")
    ).toHaveValue("");
  });
});
