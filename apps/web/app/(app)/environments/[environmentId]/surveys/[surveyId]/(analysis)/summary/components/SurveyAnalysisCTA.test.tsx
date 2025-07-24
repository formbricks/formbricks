import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { TEnvironment } from "@formbricks/types/environment";
import { TSegment } from "@formbricks/types/segment";
import { TSurvey } from "@formbricks/types/surveys/types";
import { TUser } from "@formbricks/types/user";
import { SurveyAnalysisCTA } from "./SurveyAnalysisCTA";

// Mock the useTranslate hook
vi.mock("@tolgee/react", () => ({
  useTranslate: () => ({
    t: (key: string) => {
      if (key === "environments.surveys.summary.configure_alerts") {
        return "Configure alerts";
      }
      if (key === "common.preview") {
        return "Preview";
      }
      if (key === "common.edit") {
        return "Edit";
      }
      if (key === "environments.surveys.summary.share_survey") {
        return "Share survey";
      }
      if (key === "environments.surveys.summary.results_are_public") {
        return "Results are public";
      }
      if (key === "environments.surveys.survey_duplicated_successfully") {
        return "Survey duplicated successfully";
      }
      if (key === "environments.surveys.edit.caution_edit_duplicate") {
        return "Duplicate & Edit";
      }
      if (key === "environments.surveys.summary.reset_survey") {
        return "Reset survey";
      }
      if (key === "environments.surveys.summary.delete_all_existing_responses_and_displays") {
        return "Delete all existing responses and displays";
      }
      if (key === "environments.surveys.summary.reset_survey_warning") {
        return "Resetting a survey removes all responses and metadata of this survey. This cannot be undone.";
      }
      if (key === "environments.surveys.summary.survey_reset_successfully") {
        return "Survey reset successfully! 5 responses and 3 displays were deleted.";
      }
      return key;
    },
  }),
}));

// Mock Next.js hooks
const mockPush = vi.fn();
const mockRefresh = vi.fn();
const mockPathname = "/environments/test-env-id/surveys/test-survey-id/summary";
const mockSearchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    refresh: mockRefresh,
  }),
  usePathname: () => mockPathname,
  useSearchParams: () => mockSearchParams,
}));

// Mock react-hot-toast
vi.mock("react-hot-toast", () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock helper functions
vi.mock("@/lib/utils/helper", () => ({
  getFormattedErrorMessage: vi.fn(() => "Error message"),
}));

// Mock actions
vi.mock("@/modules/survey/list/actions", () => ({
  copySurveyToOtherEnvironmentAction: vi.fn(),
}));

vi.mock("../actions", () => ({
  resetSurveyAction: vi.fn(),
}));

// Mock the useSingleUseId hook
vi.mock("@/modules/survey/hooks/useSingleUseId", () => ({
  useSingleUseId: vi.fn(() => ({
    singleUseId: "test-single-use-id",
    refreshSingleUseId: vi.fn().mockResolvedValue("test-single-use-id"),
  })),
}));

// Mock child components
vi.mock(
  "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/components/SuccessMessage",
  () => ({
    SuccessMessage: ({ environment, survey }: any) => (
      <div data-testid="success-message">
        Success Message for {environment.id} - {survey.id}
      </div>
    ),
  })
);

vi.mock(
  "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/components/share-survey-modal",
  () => ({
    ShareSurveyModal: ({ survey, open, setOpen, modalView, user }: any) => (
      <div data-testid="share-survey-modal" data-open={open} data-modal-view={modalView}>
        Share Survey Modal for {survey.id} - User: {user.id}
        <button type="button" onClick={() => setOpen(false)}>
          Close Modal
        </button>
      </div>
    ),
  })
);

vi.mock(
  "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/components/SurveyStatusDropdown",
  () => ({
    SurveyStatusDropdown: ({ environment, survey }: any) => (
      <div data-testid="survey-status-dropdown">
        Status Dropdown for {environment.id} - {survey.id}
      </div>
    ),
  })
);

vi.mock("@/modules/survey/components/edit-public-survey-alert-dialog", () => ({
  EditPublicSurveyAlertDialog: ({
    open,
    setOpen,
    isLoading,
    primaryButtonAction,
    primaryButtonText,
    secondaryButtonAction,
    secondaryButtonText,
  }: any) => (
    <div data-testid="edit-public-survey-alert-dialog" data-open={open} data-loading={isLoading}>
      <button type="button" onClick={primaryButtonAction} data-testid="primary-button">
        {primaryButtonText}
      </button>
      <button type="button" onClick={secondaryButtonAction} data-testid="secondary-button">
        {secondaryButtonText}
      </button>
      <button type="button" onClick={() => setOpen(false)}>
        Close Dialog
      </button>
    </div>
  ),
}));

// Mock UI components
vi.mock("@/modules/ui/components/badge", () => ({
  Badge: ({ type, size, className, text }: any) => (
    <div data-testid="badge" data-type={type} data-size={size} className={className}>
      {text}
    </div>
  ),
}));

vi.mock("@/modules/ui/components/confirmation-modal", () => ({
  ConfirmationModal: ({
    open,
    setOpen,
    title,
    text,
    buttonText,
    onConfirm,
    buttonVariant,
    buttonLoading,
  }: any) => (
    <div
      data-testid="confirmation-modal"
      data-open={open}
      data-loading={buttonLoading}
      data-variant={buttonVariant}>
      <div data-testid="modal-title">{title}</div>
      <div data-testid="modal-text">{text}</div>
      <button type="button" onClick={onConfirm} data-testid="confirm-button">
        {buttonText}
      </button>
      <button type="button" onClick={() => setOpen(false)} data-testid="cancel-button">
        Cancel
      </button>
    </div>
  ),
}));

vi.mock("@/modules/ui/components/button", () => ({
  Button: ({ children, onClick, className }: any) => (
    <button type="button" data-testid="button" onClick={onClick} className={className}>
      {children}
    </button>
  ),
}));

vi.mock("@/modules/ui/components/iconbar", () => ({
  IconBar: ({ actions }: any) => (
    <div data-testid="icon-bar">
      {actions
        .filter((action: any) => action.isVisible)
        .map((action: any, index: number) => (
          <button
            type="button"
            key={index} // NOSONAR // We don't need to check this in the test
            onClick={action.onClick}
            title={action.tooltip}
            data-testid={`icon-bar-action-${index}`}>
            <action.icon />
          </button>
        ))}
    </div>
  ),
}));

// Mock lucide-react icons
vi.mock("lucide-react", () => ({
  BellRing: () => <svg data-testid="bell-ring-icon" />,
  Eye: () => <svg data-testid="eye-icon" />,
  ListRestart: () => <svg data-testid="list-restart-icon" />,
  SquarePenIcon: () => <svg data-testid="square-pen-icon" />,
}));

vi.mock("@/app/(app)/environments/[environmentId]/context/environment-context", () => ({
  useEnvironment: vi.fn(() => ({
    organizationId: "test-organization-id",
    project: { id: "test-project-id" },
  })),
}));

// Mock data
const mockEnvironment: TEnvironment = {
  id: "test-env-id",
  createdAt: new Date(),
  updatedAt: new Date(),
  type: "development",
  projectId: "test-project-id",
  appSetupCompleted: true,
};

const mockSurvey: TSurvey = {
  id: "test-survey-id",
  createdAt: new Date(),
  updatedAt: new Date(),
  name: "Test Survey",
  type: "app",
  environmentId: "test-env-id",
  status: "inProgress",
  displayOption: "displayOnce",
  autoClose: null,
  triggers: [],

  recontactDays: null,
  displayLimit: null,
  welcomeCard: { enabled: false, timeToFinish: false, showResponseCount: false },
  questions: [],
  endings: [],
  hiddenFields: { enabled: false },
  displayPercentage: null,
  autoComplete: null,

  segment: null,
  languages: [],
  showLanguageSwitch: false,
  singleUse: { enabled: false, isEncrypted: false },
  projectOverwrites: null,
  surveyClosedMessage: null,
  delay: 0,
  isVerifyEmailEnabled: false,
  createdBy: null,
  variables: [],
  followUps: [],
  runOnDate: null,
  closeOnDate: null,
  styling: null,
  pin: null,
  recaptcha: null,
  isSingleResponsePerEmailEnabled: false,
  isBackButtonHidden: false,
  resultShareKey: null,
};

const mockUser: TUser = {
  id: "test-user-id",
  name: "Test User",
  email: "test@example.com",
  emailVerified: new Date(),
  imageUrl: "https://example.com/avatar.jpg",
  twoFactorEnabled: false,
  identityProvider: "email",
  createdAt: new Date(),
  updatedAt: new Date(),

  role: "other",
  objective: "other",
  locale: "en-US",
  lastLoginAt: new Date(),
  isActive: true,
  notificationSettings: {
    alert: {
      responseFinished: true,
    },
    unsubscribedOrganizationIds: [],
  },
};

const mockSegments: TSegment[] = [];

const defaultProps = {
  survey: mockSurvey,
  environment: mockEnvironment,
  isReadOnly: false,
  user: mockUser,
  publicDomain: "https://example.com",
  responseCount: 0,
  displayCount: 0,
  segments: mockSegments,
  isContactsEnabled: true,
  isFormbricksCloud: false,
};

describe("SurveyAnalysisCTA", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParams.delete("share");
  });

  afterEach(() => {
    cleanup();
  });

  test("renders share survey button", () => {
    render(<SurveyAnalysisCTA {...defaultProps} displayCount={0} />);

    expect(screen.getByText("Share survey")).toBeInTheDocument();
  });

  test("renders success message component", () => {
    render(<SurveyAnalysisCTA {...defaultProps} displayCount={0} />);

    expect(screen.getByTestId("success-message")).toBeInTheDocument();
  });

  test("renders survey status dropdown when app setup is completed", () => {
    render(<SurveyAnalysisCTA {...defaultProps} displayCount={0} />);

    expect(screen.getByTestId("survey-status-dropdown")).toBeInTheDocument();
  });

  test("does not render survey status dropdown when read-only", () => {
    render(<SurveyAnalysisCTA {...defaultProps} isReadOnly={true} />);

    expect(screen.queryByTestId("survey-status-dropdown")).not.toBeInTheDocument();
  });

  test("renders icon bar with correct actions", () => {
    render(<SurveyAnalysisCTA {...defaultProps} displayCount={0} />);

    expect(screen.getByTestId("icon-bar")).toBeInTheDocument();
    expect(screen.getByTestId("icon-bar-action-0")).toBeInTheDocument(); // Bell ring
    expect(screen.getByTestId("icon-bar-action-1")).toBeInTheDocument(); // Square pen
  });

  test("shows preview icon for link surveys", () => {
    const linkSurvey = { ...mockSurvey, type: "link" as const };
    render(<SurveyAnalysisCTA {...defaultProps} survey={linkSurvey} />);

    expect(screen.getByTestId("icon-bar-action-1")).toHaveAttribute("title", "Preview");
  });

  test("shows public results badge when resultShareKey exists", () => {
    const surveyWithShareKey = { ...mockSurvey, resultShareKey: "share-key" };
    render(<SurveyAnalysisCTA {...defaultProps} survey={surveyWithShareKey} />);

    expect(screen.getByTestId("badge")).toBeInTheDocument();
    expect(screen.getByText("Results are public")).toBeInTheDocument();
  });

  test("opens share modal when share button is clicked", async () => {
    const user = userEvent.setup();
    render(<SurveyAnalysisCTA {...defaultProps} displayCount={0} />);

    await user.click(screen.getByText("Share survey"));

    expect(screen.getByTestId("share-survey-modal")).toBeInTheDocument();
    expect(screen.getByTestId("share-survey-modal")).toHaveAttribute("data-open", "true");
  });

  test("opens share modal when share param is true", () => {
    mockSearchParams.set("share", "true");
    render(<SurveyAnalysisCTA {...defaultProps} displayCount={0} />);

    expect(screen.getByTestId("share-survey-modal")).toHaveAttribute("data-open", "true");
    expect(screen.getByTestId("share-survey-modal")).toHaveAttribute("data-modal-view", "start");
  });

  test("navigates to edit when edit button is clicked and no responses", async () => {
    const user = userEvent.setup();
    render(<SurveyAnalysisCTA {...defaultProps} displayCount={0} />);

    await user.click(screen.getByTestId("icon-bar-action-1"));

    expect(mockPush).toHaveBeenCalledWith("/environments/test-env-id/surveys/test-survey-id/edit");
  });

  test("shows caution dialog when edit button is clicked and has responses", async () => {
    const user = userEvent.setup();
    render(<SurveyAnalysisCTA {...defaultProps} responseCount={5} />);

    // With responseCount > 0, the edit button should be at icon-bar-action-2 (after reset button)
    await user.click(screen.getByTestId("icon-bar-action-2"));

    expect(screen.getByTestId("edit-public-survey-alert-dialog")).toHaveAttribute("data-open", "true");
  });

  test("navigates to notifications when bell icon is clicked", async () => {
    const user = userEvent.setup();
    render(<SurveyAnalysisCTA {...defaultProps} displayCount={0} />);

    await user.click(screen.getByTestId("icon-bar-action-0"));

    expect(mockPush).toHaveBeenCalledWith("/environments/test-env-id/settings/notifications");
  });

  test("opens preview window when preview icon is clicked", async () => {
    const user = userEvent.setup();
    const linkSurvey = { ...mockSurvey, type: "link" as const };
    const windowOpenSpy = vi.spyOn(window, "open").mockImplementation(() => null);

    render(<SurveyAnalysisCTA {...defaultProps} survey={linkSurvey} />);

    await user.click(screen.getByTestId("icon-bar-action-1"));

    expect(windowOpenSpy).toHaveBeenCalledWith("https://example.com/s/test-survey-id?preview=true", "_blank");
    windowOpenSpy.mockRestore();
  });

  test("does not show icon bar actions when read-only", () => {
    render(<SurveyAnalysisCTA {...defaultProps} displayCount={0} isReadOnly={true} />);

    const iconBar = screen.getByTestId("icon-bar");
    expect(iconBar).toBeInTheDocument();
    // Should only show preview icon for link surveys, but this is app survey
    expect(screen.queryByTestId("icon-bar-action-0")).not.toBeInTheDocument();
  });

  test("handles modal close correctly", async () => {
    mockSearchParams.set("share", "true");
    const user = userEvent.setup();
    render(<SurveyAnalysisCTA {...defaultProps} displayCount={0} />);

    // Verify modal is open initially
    expect(screen.getByTestId("share-survey-modal")).toHaveAttribute("data-open", "true");

    await user.click(screen.getByText("Close Modal"));

    // Verify modal is closed
    expect(screen.getByTestId("share-survey-modal")).toHaveAttribute("data-open", "false");
  });

  test("shows status dropdown for link surveys", () => {
    const linkSurvey = { ...mockSurvey, type: "link" as const };
    render(<SurveyAnalysisCTA {...defaultProps} survey={linkSurvey} />);

    expect(screen.getByTestId("survey-status-dropdown")).toBeInTheDocument();
  });

  test("does not show status dropdown for draft surveys", () => {
    const draftSurvey = { ...mockSurvey, status: "draft" as const };
    render(<SurveyAnalysisCTA {...defaultProps} survey={draftSurvey} />);

    expect(screen.queryByTestId("survey-status-dropdown")).not.toBeInTheDocument();
  });

  test("does not show status dropdown when app setup is not completed", () => {
    const environmentWithoutAppSetup = { ...mockEnvironment, appSetupCompleted: false };
    render(<SurveyAnalysisCTA {...defaultProps} displayCount={0} environment={environmentWithoutAppSetup} />);

    expect(screen.queryByTestId("survey-status-dropdown")).not.toBeInTheDocument();
  });

  test("renders correctly with all props", () => {
    render(<SurveyAnalysisCTA {...defaultProps} displayCount={0} />);

    expect(screen.getByTestId("icon-bar")).toBeInTheDocument();
    expect(screen.getByText("Share survey")).toBeInTheDocument();
    expect(screen.getByTestId("success-message")).toBeInTheDocument();
    expect(screen.getByTestId("survey-status-dropdown")).toBeInTheDocument();
  });

  test("duplicates survey when primary button is clicked in edit dialog", async () => {
    const mockCopySurveyAction = vi.mocked(
      await import("@/modules/survey/list/actions")
    ).copySurveyToOtherEnvironmentAction;
    mockCopySurveyAction.mockResolvedValue({
      data: {
        ...mockSurvey,
        id: "new-survey-id",
        environmentId: "test-env-id",
        triggers: [],
        segment: null,
        resultShareKey: null,
        languages: [],
      },
    });

    const toast = await import("react-hot-toast");
    const user = userEvent.setup();

    render(<SurveyAnalysisCTA {...defaultProps} responseCount={5} />);

    // Click edit button to open dialog
    await user.click(screen.getByTestId("icon-bar-action-1"));

    // Click primary button (duplicate & edit)
    await user.click(screen.getByTestId("primary-button"));

    expect(mockCopySurveyAction).toHaveBeenCalledWith({
      environmentId: "test-env-id",
      surveyId: "test-survey-id",
      targetEnvironmentId: "test-env-id",
    });
    expect(toast.default.success).toHaveBeenCalledWith("Survey duplicated successfully");
    expect(mockPush).toHaveBeenCalledWith("/environments/test-env-id/surveys/new-survey-id/edit");
  });

  test("handles error when duplicating survey fails", async () => {
    const mockCopySurveyAction = vi.mocked(
      await import("@/modules/survey/list/actions")
    ).copySurveyToOtherEnvironmentAction;
    mockCopySurveyAction.mockResolvedValue({
      data: undefined,
      serverError: "Duplication failed",
      validationErrors: undefined,
      bindArgsValidationErrors: [],
    });

    const toast = await import("react-hot-toast");
    const user = userEvent.setup();

    render(<SurveyAnalysisCTA {...defaultProps} responseCount={5} />);

    // Click edit button to open dialog
    await user.click(screen.getByTestId("icon-bar-action-1"));

    // Click primary button (duplicate & edit)
    await user.click(screen.getByTestId("primary-button"));

    expect(toast.default.error).toHaveBeenCalledWith("Error message");
  });

  test("navigates to edit when secondary button is clicked in edit dialog", async () => {
    const user = userEvent.setup();

    render(<SurveyAnalysisCTA {...defaultProps} responseCount={5} />);

    // Click edit button to open dialog
    await user.click(screen.getByTestId("icon-bar-action-1"));

    // Click secondary button (edit)
    await user.click(screen.getByTestId("secondary-button"));

    expect(mockPush).toHaveBeenCalledWith("/environments/test-env-id/surveys/test-survey-id/edit");
  });

  test("shows loading state during duplication", async () => {
    const mockCopySurveyAction = vi.mocked(
      await import("@/modules/survey/list/actions")
    ).copySurveyToOtherEnvironmentAction;

    // Mock a delayed response
    mockCopySurveyAction.mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(
            () =>
              resolve({
                data: {
                  ...mockSurvey,
                  id: "new-survey-id",
                  environmentId: "test-env-id",
                  triggers: [],
                  segment: null,
                  resultShareKey: null,
                  languages: [],
                },
              }),
            100
          )
        )
    );

    const user = userEvent.setup();

    render(<SurveyAnalysisCTA {...defaultProps} responseCount={5} />);

    // Click edit button to open dialog
    await user.click(screen.getByTestId("icon-bar-action-1"));

    // Click primary button (duplicate & edit)
    await user.click(screen.getByTestId("primary-button"));

    // Check loading state
    expect(screen.getByTestId("edit-public-survey-alert-dialog")).toHaveAttribute("data-loading", "true");
  });

  test("closes dialog after successful duplication", async () => {
    const mockCopySurveyAction = vi.mocked(
      await import("@/modules/survey/list/actions")
    ).copySurveyToOtherEnvironmentAction;
    mockCopySurveyAction.mockResolvedValue({
      data: {
        ...mockSurvey,
        id: "new-survey-id",
        environmentId: "test-env-id",
        triggers: [],
        segment: null,
        resultShareKey: null,
        languages: [],
      },
    });

    const user = userEvent.setup();

    render(<SurveyAnalysisCTA {...defaultProps} responseCount={5} />);

    // Click edit button to open dialog (should be icon-bar-action-2 with responses)
    await user.click(screen.getByTestId("icon-bar-action-2"));
    expect(screen.getByTestId("edit-public-survey-alert-dialog")).toHaveAttribute("data-open", "true");

    // Click primary button (duplicate & edit)
    await user.click(screen.getByTestId("primary-button"));

    // Dialog should be closed
    expect(screen.getByTestId("edit-public-survey-alert-dialog")).toHaveAttribute("data-open", "false");
  });

  test("opens preview with single use ID when enabled", async () => {
    const mockUseSingleUseId = vi.mocked(
      await import("@/modules/survey/hooks/useSingleUseId")
    ).useSingleUseId;
    mockUseSingleUseId.mockReturnValue({
      singleUseId: "test-single-use-id",
      refreshSingleUseId: vi.fn().mockResolvedValue("new-single-use-id"),
    });

    const surveyWithSingleUse = {
      ...mockSurvey,
      type: "link" as const,
      singleUse: { enabled: true, isEncrypted: false },
    };

    const windowOpenSpy = vi.spyOn(window, "open").mockImplementation(() => null);
    const user = userEvent.setup();

    render(<SurveyAnalysisCTA {...defaultProps} survey={surveyWithSingleUse} />);

    await user.click(screen.getByTestId("icon-bar-action-1"));

    expect(windowOpenSpy).toHaveBeenCalledWith(
      "https://example.com/s/test-survey-id?suId=new-single-use-id&preview=true",
      "_blank"
    );
    windowOpenSpy.mockRestore();
  });

  test("handles single use ID generation failure", async () => {
    const mockUseSingleUseId = vi.mocked(
      await import("@/modules/survey/hooks/useSingleUseId")
    ).useSingleUseId;
    mockUseSingleUseId.mockReturnValue({
      singleUseId: "test-single-use-id",
      refreshSingleUseId: vi.fn().mockResolvedValue(undefined),
    });

    const surveyWithSingleUse = {
      ...mockSurvey,
      type: "link" as const,
      singleUse: { enabled: true, isEncrypted: false },
    };

    const windowOpenSpy = vi.spyOn(window, "open").mockImplementation(() => null);
    const user = userEvent.setup();

    render(<SurveyAnalysisCTA {...defaultProps} survey={surveyWithSingleUse} />);

    await user.click(screen.getByTestId("icon-bar-action-1"));

    expect(windowOpenSpy).toHaveBeenCalledWith("https://example.com/s/test-survey-id?preview=true", "_blank");
    windowOpenSpy.mockRestore();
  });

  test("opens share modal with correct modal view when share button clicked", async () => {
    const user = userEvent.setup();
    render(<SurveyAnalysisCTA {...defaultProps} displayCount={0} />);

    await user.click(screen.getByText("Share survey"));

    expect(screen.getByTestId("share-survey-modal")).toHaveAttribute("data-modal-view", "share");
  });

  test("handles different survey statuses correctly", () => {
    const completedSurvey = { ...mockSurvey, status: "completed" as const };
    render(<SurveyAnalysisCTA {...defaultProps} survey={completedSurvey} />);

    expect(screen.getByTestId("survey-status-dropdown")).toBeInTheDocument();
  });

  test("handles paused survey status", () => {
    const pausedSurvey = { ...mockSurvey, status: "paused" as const };
    render(<SurveyAnalysisCTA {...defaultProps} survey={pausedSurvey} />);

    expect(screen.getByTestId("survey-status-dropdown")).toBeInTheDocument();
  });

  test("does not render share modal when user is null", () => {
    render(<SurveyAnalysisCTA {...defaultProps} displayCount={0} user={null as any} />);

    expect(screen.queryByTestId("share-survey-modal")).not.toBeInTheDocument();
  });

  test("renders with different isFormbricksCloud values", () => {
    const { rerender } = render(
      <SurveyAnalysisCTA {...defaultProps} displayCount={0} isFormbricksCloud={true} />
    );
    expect(screen.getByTestId("share-survey-modal")).toBeInTheDocument();

    rerender(<SurveyAnalysisCTA {...defaultProps} displayCount={0} isFormbricksCloud={false} />);
    expect(screen.getByTestId("share-survey-modal")).toBeInTheDocument();
  });

  test("renders with different isContactsEnabled values", () => {
    const { rerender } = render(
      <SurveyAnalysisCTA {...defaultProps} displayCount={0} isContactsEnabled={true} />
    );
    expect(screen.getByTestId("share-survey-modal")).toBeInTheDocument();

    rerender(<SurveyAnalysisCTA {...defaultProps} displayCount={0} isContactsEnabled={false} />);
    expect(screen.getByTestId("share-survey-modal")).toBeInTheDocument();
  });

  test("handles app survey type", () => {
    const appSurvey = { ...mockSurvey, type: "app" as const };
    render(<SurveyAnalysisCTA {...defaultProps} survey={appSurvey} />);

    // Should not show preview icon for app surveys
    expect(screen.queryByTestId("icon-bar-action-1")).toBeInTheDocument(); // This should be edit button
    expect(screen.getByTestId("icon-bar-action-1")).toHaveAttribute("title", "Edit");
  });

  test("handles modal state changes correctly", async () => {
    const user = userEvent.setup();
    render(<SurveyAnalysisCTA {...defaultProps} displayCount={0} />);

    // Open modal via share button
    await user.click(screen.getByText("Share survey"));
    expect(screen.getByTestId("share-survey-modal")).toHaveAttribute("data-open", "true");

    // Close modal
    await user.click(screen.getByText("Close Modal"));
    expect(screen.getByTestId("share-survey-modal")).toHaveAttribute("data-open", "false");
  });

  test("opens share modal via share button", async () => {
    const user = userEvent.setup();
    render(<SurveyAnalysisCTA {...defaultProps} displayCount={0} />);

    await user.click(screen.getByText("Share survey"));

    // Should open the modal with share view
    expect(screen.getByTestId("share-survey-modal")).toHaveAttribute("data-open", "true");
    expect(screen.getByTestId("share-survey-modal")).toHaveAttribute("data-modal-view", "share");
  });

  test("closes share modal and updates modal state", async () => {
    mockSearchParams.set("share", "true");
    const user = userEvent.setup();
    render(<SurveyAnalysisCTA {...defaultProps} displayCount={0} />);

    // Modal should be open initially due to share param
    expect(screen.getByTestId("share-survey-modal")).toHaveAttribute("data-open", "true");

    await user.click(screen.getByText("Close Modal"));

    // Should close the modal
    expect(screen.getByTestId("share-survey-modal")).toHaveAttribute("data-open", "false");
  });

  test("handles empty segments array", () => {
    render(<SurveyAnalysisCTA {...defaultProps} displayCount={0} segments={[]} />);

    expect(screen.getByTestId("share-survey-modal")).toBeInTheDocument();
  });

  test("handles zero response count", () => {
    render(<SurveyAnalysisCTA {...defaultProps} displayCount={0} responseCount={0} />);

    expect(screen.queryByTestId("edit-public-survey-alert-dialog")).not.toBeInTheDocument();
  });

  test("shows all icon actions for non-readonly app survey", () => {
    render(<SurveyAnalysisCTA {...defaultProps} displayCount={0} />);

    // Should show bell (notifications) and edit actions
    expect(screen.getByTestId("icon-bar-action-0")).toHaveAttribute("title", "Configure alerts");
    expect(screen.getByTestId("icon-bar-action-1")).toHaveAttribute("title", "Edit");
  });

  test("shows all icon actions for non-readonly link survey", () => {
    const linkSurvey = { ...mockSurvey, type: "link" as const };
    render(<SurveyAnalysisCTA {...defaultProps} survey={linkSurvey} />);

    // Should show bell (notifications), preview, and edit actions
    expect(screen.getByTestId("icon-bar-action-0")).toHaveAttribute("title", "Configure alerts");
    expect(screen.getByTestId("icon-bar-action-1")).toHaveAttribute("title", "Preview");
    expect(screen.getByTestId("icon-bar-action-2")).toHaveAttribute("title", "Edit");
  });

  // Reset Survey Feature Tests
  test("shows reset survey button when responses exist", () => {
    render(<SurveyAnalysisCTA {...defaultProps} responseCount={5} />);

    const iconActions = screen.getAllByTestId(/icon-bar-action-/);
    const resetButton = iconActions.find((button) => button.getAttribute("title") === "Reset survey");
    expect(resetButton).toBeInTheDocument();
  });

  test("shows reset survey button when displays exist", () => {
    render(<SurveyAnalysisCTA {...defaultProps} displayCount={3} />);

    const iconActions = screen.getAllByTestId(/icon-bar-action-/);
    const resetButton = iconActions.find((button) => button.getAttribute("title") === "Reset survey");
    expect(resetButton).toBeInTheDocument();
  });

  test("hides reset survey button when no responses or displays exist", () => {
    render(<SurveyAnalysisCTA {...defaultProps} responseCount={0} displayCount={0} />);

    const iconActions = screen.getAllByTestId(/icon-bar-action-/);
    const resetButton = iconActions.find((button) => button.getAttribute("title") === "Reset survey");
    expect(resetButton).toBeUndefined();
  });

  test("hides reset survey button for read-only users", () => {
    render(<SurveyAnalysisCTA {...defaultProps} isReadOnly={true} responseCount={5} displayCount={3} />);

    // For read-only users, there should be no icon bar actions
    expect(screen.queryAllByTestId(/icon-bar-action-/)).toHaveLength(0);
  });

  test("opens reset confirmation modal when reset button is clicked", async () => {
    const user = userEvent.setup();
    render(<SurveyAnalysisCTA {...defaultProps} responseCount={5} />);

    const iconActions = screen.getAllByTestId(/icon-bar-action-/);
    const resetButton = iconActions.find((button) => button.getAttribute("title") === "Reset survey");

    expect(resetButton).toBeDefined();
    await user.click(resetButton!);

    expect(screen.getByTestId("confirmation-modal")).toHaveAttribute("data-open", "true");
    expect(screen.getByTestId("modal-title")).toHaveTextContent("Delete all existing responses and displays");
    expect(screen.getByTestId("modal-text")).toHaveTextContent(
      "Resetting a survey removes all responses and metadata of this survey. This cannot be undone."
    );
  });

  test("executes reset survey action when confirmed", async () => {
    const mockResetSurveyAction = vi.mocked(await import("../actions")).resetSurveyAction;
    mockResetSurveyAction.mockResolvedValue({
      data: {
        success: true,
        deletedResponsesCount: 5,
        deletedDisplaysCount: 3,
      },
    });

    const toast = await import("react-hot-toast");
    const user = userEvent.setup();

    render(<SurveyAnalysisCTA {...defaultProps} responseCount={5} />);

    // Open reset modal
    const iconActions = screen.getAllByTestId(/icon-bar-action-/);
    const resetButton = iconActions.find((button) => button.getAttribute("title") === "Reset survey");
    expect(resetButton).toBeDefined();
    await user.click(resetButton!);

    // Confirm reset
    await user.click(screen.getByTestId("confirm-button"));

    expect(mockResetSurveyAction).toHaveBeenCalledWith({
      surveyId: "test-survey-id",
      organizationId: "test-organization-id",
      projectId: "test-project-id",
    });
    expect(toast.default.success).toHaveBeenCalledWith(
      "Survey reset successfully! 5 responses and 3 displays were deleted."
    );
  });

  test("handles reset survey action error", async () => {
    const mockResetSurveyAction = vi.mocked(await import("../actions")).resetSurveyAction;
    mockResetSurveyAction.mockResolvedValue({
      data: undefined,
      serverError: "Reset failed",
      validationErrors: undefined,
      bindArgsValidationErrors: [],
    });

    const toast = await import("react-hot-toast");
    const user = userEvent.setup();

    render(<SurveyAnalysisCTA {...defaultProps} responseCount={5} />);

    // Open reset modal
    const iconActions = screen.getAllByTestId(/icon-bar-action-/);
    const resetButton = iconActions.find((button) => button.getAttribute("title") === "Reset survey");
    expect(resetButton).toBeDefined();
    await user.click(resetButton!);

    // Confirm reset
    await user.click(screen.getByTestId("confirm-button"));

    expect(toast.default.error).toHaveBeenCalledWith("Error message");
  });

  test("shows loading state during reset operation", async () => {
    const mockResetSurveyAction = vi.mocked(await import("../actions")).resetSurveyAction;

    // Mock a delayed response
    mockResetSurveyAction.mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(
            () =>
              resolve({
                data: {
                  success: true,
                  deletedResponsesCount: 5,
                  deletedDisplaysCount: 3,
                },
              }),
            100
          )
        )
    );

    const user = userEvent.setup();
    render(<SurveyAnalysisCTA {...defaultProps} responseCount={5} />);

    // Open reset modal
    const iconActions = screen.getAllByTestId(/icon-bar-action-/);
    const resetButton = iconActions.find((button) => button.getAttribute("title") === "Reset survey");
    expect(resetButton).toBeDefined();
    await user.click(resetButton!);

    // Confirm reset
    await user.click(screen.getByTestId("confirm-button"));

    // Check loading state
    expect(screen.getByTestId("confirmation-modal")).toHaveAttribute("data-loading", "true");
  });

  test("closes reset modal after successful reset", async () => {
    const mockResetSurveyAction = vi.mocked(await import("../actions")).resetSurveyAction;
    mockResetSurveyAction.mockResolvedValue({
      data: {
        success: true,
        deletedResponsesCount: 5,
        deletedDisplaysCount: 3,
      },
    });

    const user = userEvent.setup();
    render(<SurveyAnalysisCTA {...defaultProps} responseCount={5} />);

    // Open reset modal
    const iconActions = screen.getAllByTestId(/icon-bar-action-/);
    const resetButton = iconActions.find((button) => button.getAttribute("title") === "Reset survey");
    expect(resetButton).toBeDefined();
    await user.click(resetButton!);
    expect(screen.getByTestId("confirmation-modal")).toHaveAttribute("data-open", "true");

    // Confirm reset - wait for the action to complete
    await user.click(screen.getByTestId("confirm-button"));

    // Wait for the action to complete and the modal to close
    await vi.waitFor(() => {
      expect(screen.getByTestId("confirmation-modal")).toHaveAttribute("data-open", "false");
    });
  });

  test("cancels reset operation when cancel button is clicked", async () => {
    const user = userEvent.setup();
    render(<SurveyAnalysisCTA {...defaultProps} responseCount={5} />);

    // Open reset modal
    const iconActions = screen.getAllByTestId(/icon-bar-action-/);
    const resetButton = iconActions.find((button) => button.getAttribute("title") === "Reset survey");
    expect(resetButton).toBeDefined();
    await user.click(resetButton!);
    expect(screen.getByTestId("confirmation-modal")).toHaveAttribute("data-open", "true");

    // Cancel reset
    await user.click(screen.getByTestId("cancel-button"));

    // Modal should be closed
    expect(screen.getByTestId("confirmation-modal")).toHaveAttribute("data-open", "false");
  });

  test("shows destructive button variant for reset confirmation", async () => {
    const user = userEvent.setup();
    render(<SurveyAnalysisCTA {...defaultProps} responseCount={5} />);

    // Open reset modal
    const iconActions = screen.getAllByTestId(/icon-bar-action-/);
    const resetButton = iconActions.find((button) => button.getAttribute("title") === "Reset survey");
    expect(resetButton).toBeDefined();
    await user.click(resetButton!);

    expect(screen.getByTestId("confirmation-modal")).toHaveAttribute("data-variant", "destructive");
  });

  test("refreshes page after successful reset", async () => {
    const mockResetSurveyAction = vi.mocked(await import("../actions")).resetSurveyAction;

    mockResetSurveyAction.mockResolvedValue({
      data: {
        success: true,
        deletedResponsesCount: 5,
        deletedDisplaysCount: 3,
      },
    });

    const user = userEvent.setup();
    render(<SurveyAnalysisCTA {...defaultProps} responseCount={5} />);

    // Open reset modal
    const iconActions = screen.getAllByTestId(/icon-bar-action-/);
    const resetButton = iconActions.find((button) => button.getAttribute("title") === "Reset survey");
    expect(resetButton).toBeDefined();
    await user.click(resetButton!);

    // Confirm reset
    await user.click(screen.getByTestId("confirm-button"));

    expect(mockRefresh).toHaveBeenCalled();
  });
});
