import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { TEnvironment } from "@formbricks/types/environment";
import { TSurvey, TSurveyStatus } from "@formbricks/types/surveys/types";
import { TUser } from "@formbricks/types/user";
import { SurveyAnalysisCTA } from "./SurveyAnalysisCTA";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
  usePathname: () => "/environments/env123/surveys/survey123/summary",
  useSearchParams: () => ({
    get: vi.fn((param) => (param === "share" ? "false" : null)),
    toString: () => "",
  }),
}));

// Mock sharing components
vi.mock(
  "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/components/ShareEmbedSurvey",
  () => ({
    ShareEmbedSurvey: ({ open, setOpen, modalView }: any) => (
      <div data-testid={`share-embed-${modalView}`} data-open={open}>
        <button onClick={() => setOpen(false)}>Close {modalView}</button>
      </div>
    ),
  })
);

vi.mock(
  "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/components/SuccessMessage",
  () => ({
    SuccessMessage: () => <div data-testid="success-message">Success Message</div>,
  })
);

vi.mock(
  "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/components/SurveyStatusDropdown",
  () => ({
    SurveyStatusDropdown: () => <div data-testid="survey-status-dropdown">Survey Status</div>,
  })
);

// Mock modules
vi.mock("@/modules/survey/hooks/useSingleUseId", () => ({
  useSingleUseId: () => ({ refreshSingleUseId: () => Promise.resolve("new-id") }),
}));

vi.mock("react-hot-toast", () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@/modules/ui/components/iconbar", () => ({
  IconBar: ({ actions }: any) => (
    <div data-testid="icon-bar">
      {actions
        .filter((action: any) => action.isVisible)
        .map((action: any, idx: number) => (
          <button
            key={idx}
            onClick={action.onClick}
            title={action.tooltip}
            data-testid={`icon-action-${idx}`}>
            {action.tooltip}
          </button>
        ))}
    </div>
  ),
}));

vi.mock("@/modules/ui/components/badge", () => ({
  Badge: ({ text }: any) => <div data-testid="public-results-badge">{text}</div>,
}));

vi.mock("@/modules/survey/lib/client-utils", () => ({
  copySurveyLink: () => "https://copiedlink.com/survey",
}));

describe("SurveyAnalysisCTA", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  const mockSurvey: TSurvey = {
    id: "survey123",
    environmentId: "env123",
    type: "link",
    status: "inProgress",
    resultShareKey: null,
  } as TSurvey;

  const mockEnvironment: TEnvironment = {
    id: "env123",
    appSetupCompleted: true,
  } as TEnvironment;

  const mockUser: TUser = {
    id: "user123",
    email: "test@example.com",
  } as TUser;

  const defaultProps = {
    survey: mockSurvey,
    environment: mockEnvironment,
    isReadOnly: false,
    user: mockUser,
    surveyDomain: "https://survey.example.com",
  };

  test("renders icon actions for link survey", async () => {
    render(<SurveyAnalysisCTA {...defaultProps} />);

    // Check if IconBar is rendered with the correct number of actions
    expect(screen.getByTestId("icon-bar")).toBeInTheDocument();

    // For link survey, should have preview and copy link actions visible
    expect(screen.getByTitle("common.preview")).toBeInTheDocument();
    expect(screen.getByTitle("common.copy_link")).toBeInTheDocument();
    expect(screen.getByTitle("common.embed")).toBeInTheDocument();
    expect(screen.getByTitle("environments.surveys.summary.configure_alerts")).toBeInTheDocument();
    expect(screen.getByTitle("environments.surveys.summary.send_to_panel")).toBeInTheDocument();
    expect(screen.getByTitle("common.edit")).toBeInTheDocument();

    // Success message should be present
    expect(screen.getByTestId("success-message")).toBeInTheDocument();
  });

  test("renders survey status dropdown for non-draft surveys", () => {
    render(<SurveyAnalysisCTA {...defaultProps} />);

    expect(screen.getByTestId("survey-status-dropdown")).toBeInTheDocument();
  });

  test("doesn't render survey status dropdown for draft surveys", () => {
    const draftSurvey = {
      ...mockSurvey,
      status: "draft" as TSurveyStatus,
    };

    render(<SurveyAnalysisCTA {...defaultProps} survey={draftSurvey} />);

    expect(screen.queryByTestId("survey-status-dropdown")).not.toBeInTheDocument();
  });

  test("renders public results badge when resultShareKey exists", () => {
    const surveyWithShareKey = {
      ...mockSurvey,
      resultShareKey: "share-key-123",
    };

    render(<SurveyAnalysisCTA {...defaultProps} survey={surveyWithShareKey} />);

    expect(screen.getByTestId("public-results-badge")).toBeInTheDocument();
    expect(screen.getByText("environments.surveys.summary.results_are_public")).toBeInTheDocument();
  });

  test("doesn't render badge when resultShareKey is null", () => {
    render(<SurveyAnalysisCTA {...defaultProps} />);

    expect(screen.queryByTestId("public-results-badge")).not.toBeInTheDocument();
  });

  test("renders the correct modal components", () => {
    render(<SurveyAnalysisCTA {...defaultProps} />);

    // All share modals should be present but closed
    expect(screen.getByTestId("share-embed-start")).toBeInTheDocument();
    expect(screen.getByTestId("share-embed-embed")).toBeInTheDocument();
    expect(screen.getByTestId("share-embed-panel")).toBeInTheDocument();
  });

  test("hides edit actions in read-only mode", () => {
    render(<SurveyAnalysisCTA {...defaultProps} isReadOnly={true} />);

    // Edit related buttons should not be visible
    expect(screen.queryByTitle("common.edit")).not.toBeInTheDocument();
    expect(screen.queryByTitle("environments.surveys.summary.configure_alerts")).not.toBeInTheDocument();
    expect(screen.queryByTitle("environments.surveys.summary.send_to_panel")).not.toBeInTheDocument();
  });

  test("renders the correct icons for app type survey", () => {
    const appSurvey = {
      ...mockSurvey,
      type: "app" as TSurvey["type"],
    };

    render(<SurveyAnalysisCTA {...defaultProps} survey={appSurvey} />);

    // Preview and copy link should not be visible for app surveys
    expect(screen.queryByTitle("common.preview")).not.toBeInTheDocument();
    expect(screen.queryByTitle("common.copy_link")).not.toBeInTheDocument();

    // But embed should still be visible
    expect(screen.getByTitle("common.embed")).toBeInTheDocument();
  });

  test("shows appropriate actions when widget setup is not completed for app survey", () => {
    const appSurvey = {
      ...mockSurvey,
      type: "app" as TSurvey["type"],
    };

    const envWithoutSetup = {
      ...mockEnvironment,
      appSetupCompleted: false,
    };

    render(<SurveyAnalysisCTA {...defaultProps} survey={appSurvey} environment={envWithoutSetup} />);

    // Status dropdown should not be visible when setup is not completed
    expect(screen.queryByTestId("survey-status-dropdown")).not.toBeInTheDocument();
  });
});
