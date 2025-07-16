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
      return key;
    },
  }),
}));

// Mock Next.js hooks
const mockPush = vi.fn();
const mockPathname = "/environments/env-id/surveys/survey-id/summary";
const mockSearchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
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
  SquarePenIcon: () => <svg data-testid="square-pen-icon" />,
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
      weeklySummary: true,
      responseFinished: true,
    },
    weeklySummary: {
      test: true,
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
    render(<SurveyAnalysisCTA {...defaultProps} />);

    expect(screen.getByText("Share survey")).toBeInTheDocument();
  });

  test("renders success message component", () => {
    render(<SurveyAnalysisCTA {...defaultProps} />);

    expect(screen.getByTestId("success-message")).toBeInTheDocument();
  });

  test("renders survey status dropdown when app setup is completed", () => {
    render(<SurveyAnalysisCTA {...defaultProps} />);

    expect(screen.getByTestId("survey-status-dropdown")).toBeInTheDocument();
  });

  test("does not render survey status dropdown when read-only", () => {
    render(<SurveyAnalysisCTA {...defaultProps} isReadOnly={true} />);

    expect(screen.queryByTestId("survey-status-dropdown")).not.toBeInTheDocument();
  });

  test("renders icon bar with correct actions", () => {
    render(<SurveyAnalysisCTA {...defaultProps} />);

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
    render(<SurveyAnalysisCTA {...defaultProps} />);

    await user.click(screen.getByText("Share survey"));

    expect(screen.getByTestId("share-survey-modal")).toBeInTheDocument();
    expect(screen.getByTestId("share-survey-modal")).toHaveAttribute("data-open", "true");
  });

  test("opens share modal when share param is true", () => {
    mockSearchParams.set("share", "true");
    render(<SurveyAnalysisCTA {...defaultProps} />);

    expect(screen.getByTestId("share-survey-modal")).toHaveAttribute("data-open", "true");
    expect(screen.getByTestId("share-survey-modal")).toHaveAttribute("data-modal-view", "start");
  });

  test("navigates to edit when edit button is clicked and no responses", async () => {
    const user = userEvent.setup();
    render(<SurveyAnalysisCTA {...defaultProps} />);

    await user.click(screen.getByTestId("icon-bar-action-1"));

    expect(mockPush).toHaveBeenCalledWith("/environments/test-env-id/surveys/test-survey-id/edit");
  });

  test("shows caution dialog when edit button is clicked and has responses", async () => {
    const user = userEvent.setup();
    render(<SurveyAnalysisCTA {...defaultProps} responseCount={5} />);

    await user.click(screen.getByTestId("icon-bar-action-1"));

    expect(screen.getByTestId("edit-public-survey-alert-dialog")).toHaveAttribute("data-open", "true");
  });

  test("navigates to notifications when bell icon is clicked", async () => {
    const user = userEvent.setup();
    render(<SurveyAnalysisCTA {...defaultProps} />);

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
    render(<SurveyAnalysisCTA {...defaultProps} isReadOnly={true} />);

    const iconBar = screen.getByTestId("icon-bar");
    expect(iconBar).toBeInTheDocument();
    // Should only show preview icon for link surveys, but this is app survey
    expect(screen.queryByTestId("icon-bar-action-0")).not.toBeInTheDocument();
  });

  test("handles modal close correctly", async () => {
    mockSearchParams.set("share", "true");
    const user = userEvent.setup();
    render(<SurveyAnalysisCTA {...defaultProps} />);

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
    render(<SurveyAnalysisCTA {...defaultProps} environment={environmentWithoutAppSetup} />);

    expect(screen.queryByTestId("survey-status-dropdown")).not.toBeInTheDocument();
  });

  test("renders correctly with all props", () => {
    render(<SurveyAnalysisCTA {...defaultProps} />);

    expect(screen.getByTestId("icon-bar")).toBeInTheDocument();
    expect(screen.getByText("Share survey")).toBeInTheDocument();
    expect(screen.getByTestId("success-message")).toBeInTheDocument();
    expect(screen.getByTestId("survey-status-dropdown")).toBeInTheDocument();
  });
});
