import { createOrUpdateIntegrationAction } from "@/app/(app)/environments/[environmentId]/integrations/actions";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { TIntegrationItem } from "@formbricks/types/integration";
import {
  TIntegrationSlack,
  TIntegrationSlackConfigData,
  TIntegrationSlackCredential,
} from "@formbricks/types/integration/slack";
import { TSurvey, TSurveyQuestion, TSurveyQuestionTypeEnum } from "@formbricks/types/surveys/types";
import { AddChannelMappingModal } from "./AddChannelMappingModal";

// Mock dependencies
vi.mock("@/app/(app)/environments/[environmentId]/integrations/actions", () => ({
  createOrUpdateIntegrationAction: vi.fn(),
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
  DropdownSelector: ({ label, items, selectedItem, setSelectedItem, disabled }: any) => (
    <div>
      <label>{label}</label>
      <select
        data-testid={label.includes("channel") ? "channel-dropdown" : "survey-dropdown"}
        value={selectedItem?.id || ""}
        onChange={(e) => {
          const selected = items.find((item: any) => item.id === e.target.value);
          setSelectedItem(selected);
        }}
        disabled={disabled}>
        <option value="">Select...</option>
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
vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
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
      if (key === "environments.integrations.slack.link_slack_channel") return "Link Slack Channel";
      if (key === "common.update") return "Update";
      if (key === "common.delete") return "Delete";
      if (key === "common.cancel") return "Cancel";
      if (key === "environments.integrations.slack.select_channel") return "Select channel";
      if (key === "common.select_survey") return "Select survey";
      if (key === "common.questions") return "Questions";
      if (key === "environments.integrations.slack.please_select_a_channel")
        return "Please select a channel.";
      if (key === "environments.integrations.please_select_a_survey_error") return "Please select a survey.";
      if (key === "environments.integrations.select_at_least_one_question_error")
        return "Please select at least one question.";
      if (key === "environments.integrations.integration_updated_successfully")
        return "Integration updated successfully.";
      if (key === "environments.integrations.integration_added_successfully")
        return "Integration added successfully.";
      if (key === "environments.integrations.integration_removed_successfully")
        return "Integration removed successfully.";
      if (key === "environments.integrations.slack.dont_see_your_channel") return "Don't see your channel?";
      if (key === "common.note") return "Note";
      if (key === "environments.integrations.slack.already_connected_another_survey")
        return "This channel is already connected to another survey.";
      if (key === "environments.integrations.slack.create_at_least_one_channel_error")
        return "Please create at least one channel in Slack first.";
      if (key === "environments.integrations.create_survey_warning")
        return "You need to create a survey first.";
      if (key === "environments.integrations.slack.link_channel") return "Link Channel";
      return key; // Return key if no translation is found
    },
  });
  return { TolgeeProvider: MockTolgeeProvider, useTranslate };
});
vi.mock("lucide-react", () => ({
  CircleHelpIcon: () => <div data-testid="circle-help-icon" />,
  Check: () => <div data-testid="check-icon" />, // Add the Check icon mock
  Loader2: () => <div data-testid="loader-icon" />, // Add the Loader2 icon mock
}));

// Mock dependencies
const createOrUpdateIntegrationActionMock = vi.mocked(createOrUpdateIntegrationAction);
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

const channels: TIntegrationItem[] = [
  { id: "channel1", name: "#general" },
  { id: "channel2", name: "#random" },
];

const mockSlackIntegration: TIntegrationSlack = {
  id: "integration1",
  type: "slack",
  environmentId: environmentId,
  config: {
    key: {
      access_token: "xoxb-test-token",
      team_name: "Test Team",
      team_id: "T123",
    } as unknown as TIntegrationSlackCredential,
    data: [], // Initially empty
  },
};

const mockSelectedIntegration: TIntegrationSlackConfigData & { index: number } = {
  channelId: channels[0].id,
  channelName: channels[0].name,
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

describe("AddChannelMappingModal", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  beforeEach(() => {
    // Reset integration data before each test if needed
    mockSlackIntegration.config.data = [
      { ...mockSelectedIntegration }, // Simulate existing data for update/delete tests
    ];
  });

  test("renders correctly when open (create mode)", () => {
    render(
      <AddChannelMappingModal
        environmentId={environmentId}
        open={true}
        surveys={surveys}
        setOpen={mockSetOpen}
        slackIntegration={mockSlackIntegration}
        channels={channels}
        selectedIntegration={null}
      />
    );

    expect(screen.getByTestId("modal")).toBeInTheDocument();
    expect(
      screen.getByText("Link Slack Channel", { selector: "div.text-xl.font-medium" })
    ).toBeInTheDocument();
    expect(screen.getByTestId("channel-dropdown")).toBeInTheDocument();
    expect(screen.getByTestId("survey-dropdown")).toBeInTheDocument();
    expect(screen.getByText("Cancel")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Link Channel" })).toBeInTheDocument();
    expect(screen.queryByText("Delete")).not.toBeInTheDocument();
    expect(screen.queryByText("Questions")).not.toBeInTheDocument();
    expect(screen.getByTestId("circle-help-icon")).toBeInTheDocument();
    expect(screen.getByText("Don't see your channel?")).toBeInTheDocument();
  });

  test("renders correctly when open (update mode)", () => {
    render(
      <AddChannelMappingModal
        environmentId={environmentId}
        open={true}
        surveys={surveys}
        setOpen={mockSetOpen}
        slackIntegration={mockSlackIntegration}
        channels={channels}
        selectedIntegration={mockSelectedIntegration}
      />
    );

    expect(screen.getByTestId("modal")).toBeInTheDocument();
    expect(
      screen.getByText("Link Slack Channel", { selector: "div.text-xl.font-medium" })
    ).toBeInTheDocument();
    expect(screen.getByTestId("channel-dropdown")).toHaveValue(channels[0].id);
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
      <AddChannelMappingModal
        environmentId={environmentId}
        open={true}
        surveys={surveys}
        setOpen={mockSetOpen}
        slackIntegration={mockSlackIntegration}
        channels={channels}
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
      <AddChannelMappingModal
        environmentId={environmentId}
        open={true}
        surveys={surveys}
        setOpen={mockSetOpen}
        slackIntegration={mockSlackIntegration}
        channels={channels}
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
    createOrUpdateIntegrationActionMock.mockResolvedValue({ data: null as any }); // Mock successful action

    render(
      <AddChannelMappingModal
        environmentId={environmentId}
        open={true}
        surveys={surveys}
        setOpen={mockSetOpen}
        slackIntegration={{ ...mockSlackIntegration, config: { ...mockSlackIntegration.config, data: [] } }} // Start with empty data
        channels={channels}
        selectedIntegration={null}
      />
    );

    const channelDropdown = screen.getByTestId("channel-dropdown");
    const surveyDropdown = screen.getByTestId("survey-dropdown");
    const submitButton = screen.getByRole("button", { name: "Link Channel" });

    await userEvent.selectOptions(channelDropdown, channels[1].id);
    await userEvent.selectOptions(surveyDropdown, surveys[0].id);

    // Wait for questions to appear and potentially uncheck one
    const firstQuestionCheckbox = await screen.findByLabelText(surveys[0].questions[0].headline.default);
    await userEvent.click(firstQuestionCheckbox); // Uncheck first question

    // Check additional settings
    await userEvent.click(screen.getByTestId("include-variables"));
    await userEvent.click(screen.getByTestId("include-metadata"));

    await userEvent.click(submitButton);

    await waitFor(() => {
      expect(createOrUpdateIntegrationActionMock).toHaveBeenCalledWith({
        environmentId,
        integrationData: expect.objectContaining({
          type: "slack",
          config: expect.objectContaining({
            key: mockSlackIntegration.config.key,
            data: expect.arrayContaining([
              expect.objectContaining({
                channelId: channels[1].id,
                channelName: channels[1].name,
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
    createOrUpdateIntegrationActionMock.mockResolvedValue({ data: null as any });

    render(
      <AddChannelMappingModal
        environmentId={environmentId}
        open={true}
        surveys={surveys}
        setOpen={mockSetOpen}
        slackIntegration={mockSlackIntegration} // Contains initial data at index 0
        channels={channels}
        selectedIntegration={mockSelectedIntegration}
      />
    );

    const deleteButton = screen.getByText("Delete");
    await userEvent.click(deleteButton);

    await waitFor(() => {
      expect(createOrUpdateIntegrationActionMock).toHaveBeenCalledWith({
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

  test("shows validation error if no channel selected", async () => {
    render(
      <AddChannelMappingModal
        environmentId={environmentId}
        open={true}
        surveys={surveys}
        setOpen={mockSetOpen}
        slackIntegration={mockSlackIntegration}
        channels={channels}
        selectedIntegration={null}
      />
    );

    const surveyDropdown = screen.getByTestId("survey-dropdown");
    const submitButton = screen.getByRole("button", { name: "Link Channel" });

    await userEvent.selectOptions(surveyDropdown, surveys[0].id);
    // No channel selected
    await userEvent.click(submitButton);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Please select a channel.");
    });
    expect(createOrUpdateIntegrationActionMock).not.toHaveBeenCalled();
    expect(mockSetOpen).not.toHaveBeenCalled();
  });

  test("shows validation error if no survey selected", async () => {
    render(
      <AddChannelMappingModal
        environmentId={environmentId}
        open={true}
        surveys={surveys}
        setOpen={mockSetOpen}
        slackIntegration={mockSlackIntegration}
        channels={channels}
        selectedIntegration={null}
      />
    );

    const channelDropdown = screen.getByTestId("channel-dropdown");
    const submitButton = screen.getByRole("button", { name: "Link Channel" });

    await userEvent.selectOptions(channelDropdown, channels[0].id);
    // No survey selected
    await userEvent.click(submitButton);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Please select a survey.");
    });
    expect(createOrUpdateIntegrationActionMock).not.toHaveBeenCalled();
    expect(mockSetOpen).not.toHaveBeenCalled();
  });

  test("shows validation error if no questions selected", async () => {
    render(
      <AddChannelMappingModal
        environmentId={environmentId}
        open={true}
        surveys={surveys}
        setOpen={mockSetOpen}
        slackIntegration={mockSlackIntegration}
        channels={channels}
        selectedIntegration={null}
      />
    );

    const channelDropdown = screen.getByTestId("channel-dropdown");
    const surveyDropdown = screen.getByTestId("survey-dropdown");
    const submitButton = screen.getByRole("button", { name: "Link Channel" });

    await userEvent.selectOptions(channelDropdown, channels[0].id);
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
    expect(createOrUpdateIntegrationActionMock).not.toHaveBeenCalled();
    expect(mockSetOpen).not.toHaveBeenCalled();
  });

  test("shows error toast if createOrUpdateIntegrationAction fails", async () => {
    const errorMessage = "Failed to update integration";
    createOrUpdateIntegrationActionMock.mockRejectedValue(new Error(errorMessage));

    render(
      <AddChannelMappingModal
        environmentId={environmentId}
        open={true}
        surveys={surveys}
        setOpen={mockSetOpen}
        slackIntegration={mockSlackIntegration}
        channels={channels}
        selectedIntegration={null}
      />
    );

    const channelDropdown = screen.getByTestId("channel-dropdown");
    const surveyDropdown = screen.getByTestId("survey-dropdown");
    const submitButton = screen.getByRole("button", { name: "Link Channel" });

    await userEvent.selectOptions(channelDropdown, channels[0].id);
    await userEvent.selectOptions(surveyDropdown, surveys[0].id);
    await userEvent.click(submitButton);

    await waitFor(() => {
      expect(createOrUpdateIntegrationActionMock).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(errorMessage);
    });
    expect(mockSetOpen).not.toHaveBeenCalled();
  });

  test("calls setOpen(false) and resets form on cancel", async () => {
    render(
      <AddChannelMappingModal
        environmentId={environmentId}
        open={true}
        surveys={surveys}
        setOpen={mockSetOpen}
        slackIntegration={mockSlackIntegration}
        channels={channels}
        selectedIntegration={null}
      />
    );

    const channelDropdown = screen.getByTestId("channel-dropdown");
    const cancelButton = screen.getByText("Cancel");

    // Simulate some interaction
    await userEvent.selectOptions(channelDropdown, channels[0].id);
    await userEvent.click(cancelButton);

    expect(mockSetOpen).toHaveBeenCalledWith(false);
    // Re-render with open=true to check if state was reset (channel should be unselected)
    cleanup();
    render(
      <AddChannelMappingModal
        environmentId={environmentId}
        open={true}
        surveys={surveys}
        setOpen={mockSetOpen}
        slackIntegration={mockSlackIntegration}
        channels={channels}
        selectedIntegration={null}
      />
    );
    expect(screen.getByTestId("channel-dropdown")).toHaveValue("");
  });

  test("shows warning when selected channel is already connected (add mode)", async () => {
    // Add an existing connection for channel1
    const integrationWithExisting = {
      ...mockSlackIntegration,
      config: {
        ...mockSlackIntegration.config,
        data: [
          {
            channelId: "channel1",
            channelName: "#general",
            surveyId: "survey-other",
            surveyName: "Other Survey",
            questionIds: ["q-other"],
            questions: "All questions",
            createdAt: new Date(),
          } as TIntegrationSlackConfigData,
        ],
      },
    };

    render(
      <AddChannelMappingModal
        environmentId={environmentId}
        open={true}
        surveys={surveys}
        setOpen={mockSetOpen}
        slackIntegration={integrationWithExisting}
        channels={channels}
        selectedIntegration={null} // Add mode
      />
    );

    const channelDropdown = screen.getByTestId("channel-dropdown");
    await userEvent.selectOptions(channelDropdown, "channel1");

    expect(screen.getByText("This channel is already connected to another survey.")).toBeInTheDocument();
  });

  test("does not show warning when selected channel is the one being edited", async () => {
    // Edit the existing connection for channel1
    const integrationToEdit = {
      ...mockSlackIntegration,
      config: {
        ...mockSlackIntegration.config,
        data: [
          {
            channelId: "channel1",
            channelName: "#general",
            surveyId: "survey1",
            surveyName: "Survey 1",
            questionIds: ["q1"],
            questions: "Selected questions",
            createdAt: new Date(),
            index: 0,
          } as TIntegrationSlackConfigData & { index: number },
        ],
      },
    };
    const selectedIntegrationForEdit = integrationToEdit.config.data[0];

    render(
      <AddChannelMappingModal
        environmentId={environmentId}
        open={true}
        surveys={surveys}
        setOpen={mockSetOpen}
        slackIntegration={integrationToEdit}
        channels={channels}
        selectedIntegration={selectedIntegrationForEdit} // Edit mode
      />
    );

    const channelDropdown = screen.getByTestId("channel-dropdown");
    // Channel is already selected via selectedIntegration prop
    expect(channelDropdown).toHaveValue("channel1");

    expect(
      screen.queryByText("This channel is already connected to another survey.")
    ).not.toBeInTheDocument();
  });
});
