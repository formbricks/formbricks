import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { TSurveyFollowUp } from "@formbricks/database/types/survey-follow-up";
import { TSurvey, TSurveyQuestionTypeEnum } from "@formbricks/types/surveys/types";
import { FollowUpItem } from "./follow-up-item";

// mock Data:

const mockSurveyId = "lgfd7jlhdp8cekkiopihi4ye";
const mockEnvironmentId = "q7v06o64ml9nw0o4x53dqzr1";
const mockQuestion1Id = "bgx8r8594elcml4m937u79d9";
const mockQuestion2Id = "ebl0o7cye38p8r0g9cf6nvbg";
const mockQuestion3Id = "lyz9v4dj1nta4yucklxepwms";
const mockFollowUp1Id = "j4jyvddxbwswuw9nqdzicjn8";
const mockFollowUp2Id = "c76dooqu448d49gtu6qv1vge";

// Mock the useTranslate hook
vi.mock("@tolgee/react", () => ({
  useTranslate: () => ({
    t: (key: string) => key,
  }),
}));

// Mock the FollowUpModal component to verify it's opened
const mockFollowUpModal = vi.fn();
vi.mock("./follow-up-modal", () => ({
  FollowUpModal: (props) => {
    mockFollowUpModal(props);
    return <div data-testid="follow-up-modal" />;
  },
}));

describe("FollowUpItem", () => {
  // Clean up after each test
  afterEach(() => {
    cleanup();
  });

  // Common test data
  const userEmail = "user@example.com";
  const teamMemberEmails = ["team1@example.com", "team2@example.com"];

  const mockSurvey = {
    id: mockSurveyId,
    environmentId: mockEnvironmentId,
    name: "Test Survey",
    createdAt: new Date(),
    updatedAt: new Date(),
    status: "draft",
    questions: [
      {
        id: mockQuestion1Id,
        type: TSurveyQuestionTypeEnum.OpenText,
        headline: {
          default: "What would you like to know?‌‌‍‍‌‍‍‍‌‌‌‍‍‌‍‍‌‌‌‌‌‌‍‌‍‌‌",
        },
        required: true,
        charLimit: {},
        inputType: "email",
        longAnswer: false,
        buttonLabel: {
          default: "Next‌‌‍‍‌‍‍‍‌‌‌‍‍‍‌‌‌‌‌‌‌‌‍‌‍‌‌",
        },
        placeholder: {
          default: "example@email.com",
        },
      },
      {
        id: mockQuestion2Id,
        type: TSurveyQuestionTypeEnum.OpenText,
        headline: {
          default: "What would you like to know?‌‌‍‍‌‍‍‍‌‌‌‍‍‌‍‍‌‌‌‌‌‌‍‌‍‌‌",
        },
        required: true,
        charLimit: {},
        inputType: "text",
        longAnswer: false,
        buttonLabel: {
          default: "Next‌‌‍‍‌‍‍‍‌‌‌‍‍‍‌‌‌‌‌‌‌‌‍‌‍‌‌",
        },
        placeholder: {
          default: "example@email.com",
        },
      },
      {
        id: mockQuestion3Id,
        type: TSurveyQuestionTypeEnum.ContactInfo,
        email: {
          show: true,
          required: true,
          placeholder: {
            default: "Email",
          },
        },
        phone: {
          show: true,
          required: true,
          placeholder: {
            default: "Phone",
          },
        },
        company: {
          show: true,
          required: true,
          placeholder: {
            default: "Company",
          },
        },
        headline: {
          default: "Contact Question",
        },
        lastName: {
          show: true,
          required: true,
          placeholder: {
            default: "Last Name",
          },
        },
        required: true,
        firstName: {
          show: true,
          required: true,
          placeholder: {
            default: "First Name",
          },
        },
        buttonLabel: {
          default: "Next‌‌‍‍‌‌‌‍‌‌‌‍‍‌‌‌‍‌‌‌‍‍‍‌‌‌‌‌‌‌‌‍‌‍‌‌",
        },
        backButtonLabel: {
          default: "Back‌‌‍‍‌‌‌‍‌‌‌‍‍‌‌‌‍‌‌‌‍‍‍‌‌‍‌‌‌‌‌‍‌‍‌‌",
        },
      },
    ],
    hiddenFields: {
      enabled: true,
      fieldIds: ["hidden1", "hidden2"],
    },
    endings: [],
    welcomeCard: {
      html: {
        default: "Thanks for providing your feedback - let's go!‌‌‍‍‌‍‍‍‌‌‌‍‍‌‌‌‍‌‌‌‌‌‍‌‍‌‌",
      },
      enabled: false,
      headline: {
        default: "Welcome!‌‌‍‍‌‍‍‍‌‌‌‍‍‌‌‌‌‌‌‌‌‌‍‌‍‌‌",
      },
      buttonLabel: {
        default: "Next‌‌‍‍‌‍‍‍‌‌‌‍‍‌‌‍‌‌‌‌‌‌‍‌‍‌‌",
      },
      timeToFinish: false,
      showResponseCount: false,
    },
    displayPercentage: null,
    followUps: [],
  } as unknown as TSurvey;

  const createMockFollowUp = (to: string): TSurveyFollowUp => ({
    id: "followup-1",
    createdAt: new Date(),
    updatedAt: new Date(),
    surveyId: "survey-1",
    name: "Test Follow-up",
    trigger: {
      type: "response",
      properties: null,
    },
    action: {
      type: "send-email",
      properties: {
        to,
        from: "noreply@example.com",
        replyTo: [userEmail],
        subject: "Follow-up Subject",
        body: "Follow-up Body",
        attachResponseData: false, // Add the missing property
      },
    },
  });

  const setLocalSurvey = vi.fn();

  test("marks email as invalid if 'to' does not match any valid question, hidden field, or email", () => {
    // Create a follow-up with an invalid 'to' value
    const invalidFollowUp = createMockFollowUp("invalid@example.com");

    render(
      <FollowUpItem
        followUp={invalidFollowUp}
        localSurvey={mockSurvey}
        mailFrom="noreply@example.com"
        selectedLanguageCode="default"
        userEmail={userEmail}
        teamMemberEmails={teamMemberEmails}
        setLocalSurvey={setLocalSurvey}
        locale="en-US"
      />
    );

    // Check if the warning badge is displayed
    const warningBadge = screen.getByText("environments.surveys.edit.follow_ups_item_issue_detected_tag");
    expect(warningBadge).toBeInTheDocument();
  });

  test("does not mark email as invalid if 'to' matches a valid question ID", () => {
    // Create a follow-up with a valid question ID (q1 is an OpenText with email inputType)
    const validFollowUp = createMockFollowUp(mockQuestion1Id);

    render(
      <FollowUpItem
        followUp={validFollowUp}
        localSurvey={mockSurvey}
        mailFrom="noreply@example.com"
        selectedLanguageCode="default"
        userEmail={userEmail}
        teamMemberEmails={teamMemberEmails}
        setLocalSurvey={setLocalSurvey}
        locale="en-US"
      />
    );

    // Check that the warning badge is not displayed
    const warningBadges = screen.queryByText("environments.surveys.edit.follow_ups_item_issue_detected_tag");
    expect(warningBadges).not.toBeInTheDocument();
  });

  test("does not mark email as invalid if 'to' matches a valid hidden field ID", () => {
    // Create a follow-up with a valid hidden field ID
    const validFollowUp = createMockFollowUp("hidden1");

    render(
      <FollowUpItem
        followUp={validFollowUp}
        localSurvey={mockSurvey}
        mailFrom="noreply@example.com"
        selectedLanguageCode="default"
        userEmail={userEmail}
        teamMemberEmails={teamMemberEmails}
        setLocalSurvey={setLocalSurvey}
        locale="en-US"
      />
    );

    // Check that the warning badge is not displayed
    const warningBadges = screen.queryByText("environments.surveys.edit.follow_ups_item_issue_detected_tag");
    expect(warningBadges).not.toBeInTheDocument();
  });

  test("does not mark email as invalid if 'to' matches a team member email", () => {
    // Create a follow-up with a valid team member email
    const validFollowUp = createMockFollowUp("team1@example.com");

    render(
      <FollowUpItem
        followUp={validFollowUp}
        localSurvey={mockSurvey}
        mailFrom="noreply@example.com"
        selectedLanguageCode="default"
        userEmail={userEmail}
        teamMemberEmails={teamMemberEmails}
        setLocalSurvey={setLocalSurvey}
        locale="en-US"
      />
    );

    // Check that the warning badge is not displayed
    const warningBadges = screen.queryByText("environments.surveys.edit.follow_ups_item_issue_detected_tag");
    expect(warningBadges).not.toBeInTheDocument();
  });

  test("does not mark email as invalid if 'to' matches the user email", () => {
    // Create a follow-up with the user's email
    const validFollowUp = createMockFollowUp(userEmail);

    render(
      <FollowUpItem
        followUp={validFollowUp}
        localSurvey={mockSurvey}
        mailFrom="noreply@example.com"
        selectedLanguageCode="default"
        userEmail={userEmail}
        teamMemberEmails={teamMemberEmails}
        setLocalSurvey={setLocalSurvey}
        locale="en-US"
      />
    );

    // Check that the warning badge is not displayed
    const warningBadges = screen.queryByText("environments.surveys.edit.follow_ups_item_issue_detected_tag");
    expect(warningBadges).not.toBeInTheDocument();
  });

  test("does mark email as invalid if 'to' matches a question with incorrect type", () => {
    // Create a follow-up with a question ID that is not OpenText with email inputType or ContactInfo
    const invalidFollowUp = createMockFollowUp(mockQuestion2Id); // q2 is OpenText but inputType is text, not email

    render(
      <FollowUpItem
        followUp={invalidFollowUp}
        localSurvey={mockSurvey}
        mailFrom="noreply@example.com"
        selectedLanguageCode="default"
        userEmail={userEmail}
        teamMemberEmails={teamMemberEmails}
        setLocalSurvey={setLocalSurvey}
        locale="en-US"
      />
    );

    // Check if the warning badge is displayed
    const warningBadge = screen.queryByText("environments.surveys.edit.follow_ups_item_issue_detected_tag");
    expect(warningBadge).toBeInTheDocument();
  });

  test("opens the edit modal when the item is clicked", async () => {
    const user = userEvent.setup();

    // Create a follow-up with a valid question ID
    const validFollowUp = createMockFollowUp(mockQuestion1Id);

    // Render the component
    render(
      <FollowUpItem
        followUp={validFollowUp}
        localSurvey={mockSurvey}
        mailFrom="noreply@example.com"
        selectedLanguageCode="default"
        userEmail={userEmail}
        teamMemberEmails={teamMemberEmails}
        setLocalSurvey={setLocalSurvey}
        locale="en-US"
      />
    );

    // Find the clickable area
    const clickableArea = screen.getByText("Test Follow-up").closest("div");
    expect(clickableArea).toBeInTheDocument();

    // Simulate a click on the clickable area
    if (clickableArea) {
      await user.click(clickableArea);
    }

    // Wait for state updates to propagate
    await vi.waitFor(() => {
      expect(mockFollowUpModal).toHaveBeenCalledWith(expect.objectContaining({ open: true }));
    });
  });
});

describe("FollowUpItem - Ending Validation", () => {
  // Clean up after each test
  afterEach(() => {
    cleanup();
  });

  // Common test data
  const userEmail = "user@example.com";
  const teamMemberEmails = ["team1@example.com", "team2@example.com"];

  const mockSurvey = {
    id: mockSurveyId,
    environmentId: mockEnvironmentId,
    name: "Test Survey",
    createdAt: new Date(),
    updatedAt: new Date(),
    status: "draft",
    questions: [
      {
        id: mockQuestion1Id,
        type: TSurveyQuestionTypeEnum.OpenText,
        headline: {
          default: "What would you like to know?‌‌‍‍‌‍‍‍‌‌‌‍‍‌‍‍‌‌‌‌‌‌‍‌‍‌‌",
        },
        required: true,
        charLimit: {},
        inputType: "email",
        longAnswer: false,
        buttonLabel: {
          default: "Next‌‌‍‍‌‍‍‍‌‌‌‍‍‍‌‌‌‌‌‌‌‌‍‌‍‌‌",
        },
        placeholder: {
          default: "example@email.com",
        },
      },
    ],
    hiddenFields: {
      enabled: true,
      fieldIds: ["hidden1"],
    },
    endings: [
      {
        id: "ending-1",
        type: "endScreen",
        headline: { default: "Thank you!" },
      },
      {
        id: "ending-2",
        type: "redirectToUrl",
        url: "https://example.com",
        label: "Redirect Ending",
      },
    ],
    followUps: [],
  } as unknown as TSurvey;

  const createMockFollowUp = (
    triggerType: "response" | "endings",
    endingIds?: string[]
  ): TSurveyFollowUp => ({
    id: "followup-1",
    createdAt: new Date(),
    updatedAt: new Date(),
    surveyId: "survey-1",
    name: "Test Follow-up",
    trigger: {
      type: triggerType,
      properties: triggerType === "endings" ? { endingIds: endingIds || [] } : null,
    },
    action: {
      type: "send-email",
      properties: {
        to: mockQuestion1Id,
        from: "noreply@example.com",
        replyTo: [userEmail],
        subject: "Follow-up Subject",
        body: "Follow-up Body",
        attachResponseData: false,
      },
    },
  });

  const setLocalSurvey = vi.fn();

  test("marks ending as invalid if trigger.type is 'endings' and no endingIds are provided", () => {
    // Create a follow-up with trigger type "endings" but no endingIds
    const invalidFollowUp = createMockFollowUp("endings", []);

    render(
      <FollowUpItem
        followUp={invalidFollowUp}
        localSurvey={mockSurvey}
        mailFrom="noreply@example.com"
        selectedLanguageCode="default"
        userEmail={userEmail}
        teamMemberEmails={teamMemberEmails}
        setLocalSurvey={setLocalSurvey}
        locale="en-US"
      />
    );

    // Check if the warning badge is displayed
    const warningBadge = screen.getByText("environments.surveys.edit.follow_ups_item_issue_detected_tag");
    expect(warningBadge).toBeInTheDocument();
  });

  test("does not mark ending as invalid if trigger.type is 'endings' and endingIds are provided", () => {
    // Create a follow-up with trigger type "endings" and valid endingIds
    const validFollowUp = createMockFollowUp("endings", ["ending-1", "ending-2"]);

    render(
      <FollowUpItem
        followUp={validFollowUp}
        localSurvey={mockSurvey}
        mailFrom="noreply@example.com"
        selectedLanguageCode="default"
        userEmail={userEmail}
        teamMemberEmails={teamMemberEmails}
        setLocalSurvey={setLocalSurvey}
        locale="en-US"
      />
    );

    // Check that the warning badge is not displayed
    const warningBadges = screen.queryByText("environments.surveys.edit.follow_ups_item_issue_detected_tag");
    expect(warningBadges).not.toBeInTheDocument();
  });

  test("does not mark ending as invalid if trigger.type is 'response'", () => {
    // Create a follow-up with trigger type "response"
    const responseFollowUp = createMockFollowUp("response");

    render(
      <FollowUpItem
        followUp={responseFollowUp}
        localSurvey={mockSurvey}
        mailFrom="noreply@example.com"
        selectedLanguageCode="default"
        userEmail={userEmail}
        teamMemberEmails={teamMemberEmails}
        setLocalSurvey={setLocalSurvey}
        locale="en-US"
      />
    );

    // Check that the warning badge is not displayed
    const warningBadges = screen.queryByText("environments.surveys.edit.follow_ups_item_issue_detected_tag");
    expect(warningBadges).not.toBeInTheDocument();
  });
});

describe("FollowUpItem - Endings Validation", () => {
  // Clean up after each test
  afterEach(() => {
    cleanup();
  });

  // Common test data
  const userEmail = "user@example.com";
  const teamMemberEmails = ["team1@example.com", "team2@example.com"];

  // Create a mock survey with endings
  const mockSurveyWithEndings = {
    id: mockSurveyId,
    environmentId: mockEnvironmentId,
    name: "Test Survey",
    createdAt: new Date(),
    updatedAt: new Date(),
    status: "draft",
    questions: [
      {
        id: mockQuestion1Id,
        type: TSurveyQuestionTypeEnum.OpenText,
        headline: {
          default: "What would you like to know?‌‌‍‍‌‍‍‍‌‌‌‍‍‌‍‍‌‌‌‌‌‌‍‌‍‌‌",
        },
        required: true,
        charLimit: {},
        inputType: "email",
        longAnswer: false,
        buttonLabel: {
          default: "Next‌‌‍‍‌‍‍‍‌‌‌‍‍‍‌‌‌‌‌‌‌‌‍‌‍‌‌",
        },
        placeholder: {
          default: "example@email.com",
        },
      },
    ],
    hiddenFields: {
      enabled: true,
      fieldIds: ["hidden1"],
    },
    endings: [
      {
        id: "ending-1",
        type: "endScreen",
        headline: { default: "Thank you!" },
      },
      {
        id: "ending-2",
        type: "endScreen",
        headline: { default: "Completed!" },
      },
    ],
    followUps: [],
  } as unknown as TSurvey;

  // Create a follow-up with empty endingIds
  const createEmptyEndingFollowUp = (): TSurveyFollowUp => ({
    id: mockFollowUp1Id,
    createdAt: new Date(),
    updatedAt: new Date(),
    surveyId: mockSurveyId,
    name: "Test Follow-up",
    trigger: {
      type: "endings",
      properties: {
        endingIds: [], // Empty array will trigger the warning
      },
    },
    action: {
      type: "send-email",
      properties: {
        to: mockQuestion1Id, // Valid question ID
        from: "noreply@example.com",
        replyTo: [userEmail],
        subject: "Follow-up Subject",
        body: "Follow-up Body",
        attachResponseData: false,
      },
    },
  });

  // Create a follow-up with valid endingIds
  const createValidEndingFollowUp = (): TSurveyFollowUp => ({
    id: mockFollowUp2Id,
    createdAt: new Date(),
    updatedAt: new Date(),
    surveyId: mockSurveyId,
    name: "Test Follow-up",
    trigger: {
      type: "endings",
      properties: {
        endingIds: ["ending-1", "ending-2"], // Valid ending IDs
      },
    },
    action: {
      type: "send-email",
      properties: {
        to: mockQuestion1Id, // Valid question ID
        from: "noreply@example.com",
        replyTo: [userEmail],
        subject: "Follow-up Subject",
        body: "Follow-up Body",
        attachResponseData: false,
      },
    },
  });

  const setLocalSurvey = vi.fn();

  test("displays a warning when followUp.trigger.type is 'endings' but endingIds array is empty", () => {
    // Create a follow-up with empty endingIds
    const emptyEndingFollowUp = createEmptyEndingFollowUp();

    render(
      <FollowUpItem
        followUp={emptyEndingFollowUp}
        localSurvey={mockSurveyWithEndings}
        mailFrom="noreply@example.com"
        selectedLanguageCode="default"
        userEmail={userEmail}
        teamMemberEmails={teamMemberEmails}
        setLocalSurvey={setLocalSurvey}
        locale="en-US"
      />
    );

    // Check if the warning badge is displayed
    const warningBadge = screen.getByText("environments.surveys.edit.follow_ups_item_issue_detected_tag");
    expect(warningBadge).toBeInTheDocument();

    // Also verify that the ending tag is displayed
    const endingTag = screen.getByText("environments.surveys.edit.follow_ups_item_ending_tag");
    expect(endingTag).toBeInTheDocument();
  });

  test("does not display a warning when followUp.trigger.type is 'endings' and endingIds array is not empty", () => {
    // Create a follow-up with valid endingIds
    const validEndingFollowUp = createValidEndingFollowUp();

    render(
      <FollowUpItem
        followUp={validEndingFollowUp}
        localSurvey={mockSurveyWithEndings}
        mailFrom="noreply@example.com"
        selectedLanguageCode="default"
        userEmail={userEmail}
        teamMemberEmails={teamMemberEmails}
        setLocalSurvey={setLocalSurvey}
        locale="en-US"
      />
    );

    // Check that the warning badge is not displayed
    const warningBadge = screen.queryByText("environments.surveys.edit.follow_ups_item_issue_detected_tag");
    expect(warningBadge).not.toBeInTheDocument();

    // Verify that the ending tag is displayed
    const endingTag = screen.getByText("environments.surveys.edit.follow_ups_item_ending_tag");
    expect(endingTag).toBeInTheDocument();
  });
});

describe("FollowUpItem - Deletion Tests", () => {
  // Clean up after each test
  afterEach(() => {
    cleanup();
  });

  // Common test data
  const userEmail = "user@example.com";
  const teamMemberEmails = ["team1@example.com", "team2@example.com"];

  const mockSurvey = {
    id: mockSurveyId,
    environmentId: mockEnvironmentId,
    name: "Test Survey",
    createdAt: new Date(),
    updatedAt: new Date(),
    status: "draft",
    questions: [
      {
        id: mockQuestion1Id,
        type: TSurveyQuestionTypeEnum.OpenText,
        headline: {
          default: "What would you like to know?",
        },
        required: true,
        charLimit: {},
        inputType: "email",
        longAnswer: false,
        buttonLabel: {
          default: "Next",
        },
        placeholder: {
          default: "example@email.com",
        },
      },
    ],
    hiddenFields: {
      enabled: true,
      fieldIds: ["hidden1"],
    },
    endings: [],
    followUps: [],
  } as unknown as TSurvey;

  const createMockFollowUp = (): TSurveyFollowUp => ({
    id: mockFollowUp1Id,
    createdAt: new Date(),
    updatedAt: new Date(),
    surveyId: mockSurveyId,
    name: "Test Follow-up",
    trigger: {
      type: "response",
      properties: null,
    },
    action: {
      type: "send-email",
      properties: {
        to: mockQuestion1Id,
        from: "noreply@example.com",
        replyTo: [userEmail],
        subject: "Follow-up Subject",
        body: "Follow-up Body",
        attachResponseData: false,
      },
    },
  });

  test("opens delete confirmation modal when delete button is clicked", async () => {
    const user = userEvent.setup();
    const followUp = createMockFollowUp();
    const setLocalSurvey = vi.fn();

    render(
      <FollowUpItem
        followUp={followUp}
        localSurvey={mockSurvey}
        mailFrom="noreply@example.com"
        selectedLanguageCode="default"
        userEmail={userEmail}
        teamMemberEmails={teamMemberEmails}
        setLocalSurvey={setLocalSurvey}
        locale="en-US"
      />
    );

    // Find and click the delete button using the trash icon
    const deleteButton = screen.getByRole("button", { name: "common.delete" });
    await user.click(deleteButton);

    // Check if the confirmation modal is displayed
    const confirmationModal = screen.getByText("environments.surveys.edit.follow_ups_delete_modal_title");
    expect(confirmationModal).toBeInTheDocument();
  });

  test("marks follow-up as deleted when confirmed in delete modal", async () => {
    const user = userEvent.setup();
    const followUp = createMockFollowUp();
    const setLocalSurvey = vi.fn();

    render(
      <FollowUpItem
        followUp={followUp}
        localSurvey={mockSurvey}
        mailFrom="noreply@example.com"
        selectedLanguageCode="default"
        userEmail={userEmail}
        teamMemberEmails={teamMemberEmails}
        setLocalSurvey={setLocalSurvey}
        locale="en-US"
      />
    );

    // Click delete button to open modal
    const deleteButton = screen.getByRole("button", { name: "common.delete" });
    await user.click(deleteButton);

    // Click confirm button in modal
    const confirmButton = screen.getByRole("button", { name: "common.delete" });
    await user.click(confirmButton);

    // Verify that setLocalSurvey was called with a function that updates the state correctly
    expect(setLocalSurvey).toHaveBeenCalledWith(expect.any(Function));

    // Get the function that was passed to setLocalSurvey
    const updateFunction = setLocalSurvey.mock.calls[0][0];

    // Call the function with a mock previous state
    const updatedState = updateFunction({
      ...mockSurvey,
      followUps: [followUp],
    });

    // Verify the updated state
    expect(updatedState.followUps).toEqual([
      {
        ...followUp,
        deleted: true,
      },
    ]);
  });

  test("does not mark follow-up as deleted when delete is cancelled", async () => {
    const user = userEvent.setup();
    const followUp = createMockFollowUp();
    const setLocalSurvey = vi.fn();

    render(
      <FollowUpItem
        followUp={followUp}
        localSurvey={mockSurvey}
        mailFrom="noreply@example.com"
        selectedLanguageCode="default"
        userEmail={userEmail}
        teamMemberEmails={teamMemberEmails}
        setLocalSurvey={setLocalSurvey}
        locale="en-US"
      />
    );

    // Click delete button to open modal
    const deleteButton = screen.getByRole("button", { name: "common.delete" });
    await user.click(deleteButton);

    // Click cancel button in modal
    const cancelButton = screen.getByRole("button", { name: "common.cancel" });
    await user.click(cancelButton);

    // Verify that setLocalSurvey was not called
    expect(setLocalSurvey).not.toHaveBeenCalled();
  });
});
