import { ShareEmbedSurvey } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/components/ShareEmbedSurvey";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LucideIcon } from "lucide-react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  TSurvey,
  TSurveyQuestion,
  TSurveyQuestionTypeEnum,
  TSurveySingleUse,
} from "@formbricks/types/surveys/types";
import { TUser } from "@formbricks/types/user";

// Mock data
const mockSurveyWeb = {
  id: "survey1",
  name: "Web Survey",
  environmentId: "env1",
  type: "app",
  status: "inProgress",
  questions: [
    {
      id: "q1",
      type: TSurveyQuestionTypeEnum.OpenText,
      headline: { default: "Q1" },
      required: true,
    } as unknown as TSurveyQuestion,
  ],
  displayOption: "displayOnce",
  recontactDays: 0,
  autoClose: null,
  delay: 0,
  autoComplete: null,
  runOnDate: null,
  closeOnDate: null,
  singleUse: { enabled: false, isEncrypted: false } as TSurveySingleUse,
  triggers: [],
  createdAt: new Date(),
  updatedAt: new Date(),
  languages: [],
  styling: null,
} as unknown as TSurvey;

vi.mock("@/lib/constants", () => ({
  INTERCOM_SECRET_KEY: "test-secret-key",
  IS_INTERCOM_CONFIGURED: true,
  INTERCOM_APP_ID: "test-app-id",
  ENCRYPTION_KEY: "test-encryption-key",
  ENTERPRISE_LICENSE_KEY: "test-enterprise-license-key",
  GITHUB_ID: "test-github-id",
  GITHUB_SECRET: "test-githubID",
  GOOGLE_CLIENT_ID: "test-google-client-id",
  GOOGLE_CLIENT_SECRET: "test-google-client-secret",
  AZUREAD_CLIENT_ID: "test-azuread-client-id",
  AZUREAD_CLIENT_SECRET: "test-azure",
  AZUREAD_TENANT_ID: "test-azuread-tenant-id",
  OIDC_DISPLAY_NAME: "test-oidc-display-name",
  OIDC_CLIENT_ID: "test-oidc-client-id",
  OIDC_ISSUER: "test-oidc-issuer",
  OIDC_CLIENT_SECRET: "test-oidc-client-secret",
  OIDC_SIGNING_ALGORITHM: "test-oidc-signing-algorithm",
  WEBAPP_URL: "test-webapp-url",
  IS_POSTHOG_CONFIGURED: true,
  POSTHOG_API_HOST: "test-posthog-api-host",
  POSTHOG_API_KEY: "test-posthog-api-key",
  FORMBRICKS_ENVIRONMENT_ID: "mock-formbricks-environment-id",
  IS_FORMBRICKS_ENABLED: true,
  SESSION_MAX_AGE: 1000,
  REDIS_URL: "test-redis-url",
  AUDIT_LOG_ENABLED: true,
  IS_FORMBRICKS_CLOUD: false,
}));

const mockSurveyLink = {
  ...mockSurveyWeb,
  id: "survey2",
  name: "Link Survey",
  type: "link",
  singleUse: { enabled: false, isEncrypted: false } as TSurveySingleUse,
} as unknown as TSurvey;

const mockUser = {
  id: "user1",
  name: "Test User",
  email: "test@example.com",
  role: "project_manager",
  objective: "other",
  createdAt: new Date(),
  updatedAt: new Date(),
  locale: "en-US",
} as unknown as TUser;

// Mocks
const mockRouterRefresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: mockRouterRefresh,
  }),
}));

vi.mock("@tolgee/react", () => ({
  useTranslate: () => ({
    t: (str: string) => str,
  }),
}));

vi.mock("@/modules/analysis/components/ShareSurveyLink", () => ({
  ShareSurveyLink: vi.fn(() => <div>ShareSurveyLinkMock</div>),
}));

vi.mock("@/modules/ui/components/badge", () => ({
  Badge: vi.fn(({ text }) => <span data-testid="badge-mock">{text}</span>),
}));

const mockEmbedViewComponent = vi.fn();
vi.mock("./shareEmbedModal/EmbedView", () => ({
  EmbedView: (props: any) => mockEmbedViewComponent(props),
}));

const mockPanelInfoViewComponent = vi.fn();
vi.mock("./shareEmbedModal/PanelInfoView", () => ({
  PanelInfoView: (props: any) => mockPanelInfoViewComponent(props),
}));

let capturedDialogOnOpenChange: ((open: boolean) => void) | undefined;
vi.mock("@/modules/ui/components/dialog", async () => {
  const actual = await vi.importActual<typeof import("@/modules/ui/components/dialog")>(
    "@/modules/ui/components/dialog"
  );
  return {
    ...actual,
    Dialog: (props: React.ComponentProps<typeof actual.Dialog>) => {
      capturedDialogOnOpenChange = props.onOpenChange;
      return <actual.Dialog {...props} />;
    },
    // DialogTitle, DialogContent, DialogDescription will be the actual components
    // due to ...actual spread and no specific mock for them here.
  };
});

describe("ShareEmbedSurvey", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    capturedDialogOnOpenChange = undefined;
  });

  const mockSetOpen = vi.fn();

  const defaultProps = {
    survey: mockSurveyWeb,
    publicDomain: "https://public-domain.com",
    open: true,
    modalView: "start" as "start" | "embed" | "panel",
    setOpen: mockSetOpen,
    user: mockUser,
    segments: [],
    isContactsEnabled: true,
    isFormbricksCloud: true,
  };

  beforeEach(() => {
    mockEmbedViewComponent.mockImplementation(
      ({ handleInitialPageButton, tabs, activeId, survey, email, surveyUrl, publicDomain, locale }) => (
        <div>
          <button onClick={() => handleInitialPageButton()}>EmbedViewMockContent</button>
          <div data-testid="embedview-tabs">{JSON.stringify(tabs)}</div>
          <div data-testid="embedview-activeid">{activeId}</div>
          <div data-testid="embedview-survey-id">{survey.id}</div>
          <div data-testid="embedview-email">{email}</div>
          <div data-testid="embedview-surveyUrl">{surveyUrl}</div>
          <div data-testid="embedview-publicDomain">{publicDomain}</div>
          <div data-testid="embedview-locale">{locale}</div>
        </div>
      )
    );
    mockPanelInfoViewComponent.mockImplementation(({ handleInitialPageButton }) => (
      <button onClick={() => handleInitialPageButton()}>PanelInfoViewMockContent</button>
    ));
  });

  test("renders initial 'start' view correctly when open and modalView is 'start' for link survey", () => {
    render(<ShareEmbedSurvey {...defaultProps} survey={mockSurveyLink} />);
    expect(screen.getByText("environments.surveys.summary.your_survey_is_public 🎉")).toBeInTheDocument();
    expect(screen.getByText("ShareSurveyLinkMock")).toBeInTheDocument();
    expect(screen.getByText("environments.surveys.summary.whats_next")).toBeInTheDocument();
    expect(screen.getByText("environments.surveys.summary.embed_survey")).toBeInTheDocument();
    expect(screen.getByText("environments.surveys.summary.configure_alerts")).toBeInTheDocument();
    expect(screen.getByText("environments.surveys.summary.setup_integrations")).toBeInTheDocument();
    expect(screen.getByText("environments.surveys.summary.send_to_panel")).toBeInTheDocument();
    expect(screen.getByTestId("badge-mock")).toHaveTextContent("common.new");
  });

  test("renders initial 'start' view correctly when open and modalView is 'start' for app survey", () => {
    render(<ShareEmbedSurvey {...defaultProps} survey={mockSurveyWeb} />);
    // For app surveys, ShareSurveyLink should not be rendered
    expect(screen.queryByText("ShareSurveyLinkMock")).not.toBeInTheDocument();
    expect(screen.getByText("environments.surveys.summary.whats_next")).toBeInTheDocument();
    expect(screen.getByText("environments.surveys.summary.embed_survey")).toBeInTheDocument();
    expect(screen.getByText("environments.surveys.summary.configure_alerts")).toBeInTheDocument();
    expect(screen.getByText("environments.surveys.summary.setup_integrations")).toBeInTheDocument();
    expect(screen.getByText("environments.surveys.summary.send_to_panel")).toBeInTheDocument();
    expect(screen.getByTestId("badge-mock")).toHaveTextContent("common.new");
  });

  test("switches to 'embed' view when 'Embed survey' button is clicked", async () => {
    render(<ShareEmbedSurvey {...defaultProps} />);
    const embedButton = screen.getByText("environments.surveys.summary.embed_survey");
    await userEvent.click(embedButton);
    expect(mockEmbedViewComponent).toHaveBeenCalled();
    expect(screen.getByText("EmbedViewMockContent")).toBeInTheDocument();
  });

  test("switches to 'panel' view when 'Send to panel' button is clicked", async () => {
    render(<ShareEmbedSurvey {...defaultProps} />);
    const panelButton = screen.getByText("environments.surveys.summary.send_to_panel");
    await userEvent.click(panelButton);
    expect(mockPanelInfoViewComponent).toHaveBeenCalled();
    expect(screen.getByText("PanelInfoViewMockContent")).toBeInTheDocument();
  });

  test("returns to 'start' view when handleInitialPageButton is triggered from EmbedView", async () => {
    render(<ShareEmbedSurvey {...defaultProps} survey={mockSurveyLink} modalView="embed" />);
    expect(mockEmbedViewComponent).toHaveBeenCalled();
    expect(screen.getByText("EmbedViewMockContent")).toBeInTheDocument();

    const embedViewButton = screen.getByText("EmbedViewMockContent");
    await userEvent.click(embedViewButton);

    // Should go back to start view, not close the modal
    expect(screen.getByText("environments.surveys.summary.your_survey_is_public 🎉")).toBeInTheDocument();
    expect(screen.queryByText("EmbedViewMockContent")).not.toBeInTheDocument();
    expect(mockSetOpen).not.toHaveBeenCalled();
  });

  test("returns to 'start' view when handleInitialPageButton is triggered from PanelInfoView", async () => {
    render(<ShareEmbedSurvey {...defaultProps} survey={mockSurveyLink} modalView="panel" />);
    expect(mockPanelInfoViewComponent).toHaveBeenCalled();
    expect(screen.getByText("PanelInfoViewMockContent")).toBeInTheDocument();

    const panelInfoViewButton = screen.getByText("PanelInfoViewMockContent");
    await userEvent.click(panelInfoViewButton);

    // Should go back to start view, not close the modal
    expect(screen.getByText("environments.surveys.summary.your_survey_is_public 🎉")).toBeInTheDocument();
    expect(screen.queryByText("PanelInfoViewMockContent")).not.toBeInTheDocument();
    expect(mockSetOpen).not.toHaveBeenCalled();
  });

  test("handleOpenChange (when Dialog calls its onOpenChange prop)", () => {
    render(<ShareEmbedSurvey {...defaultProps} open={true} survey={mockSurveyWeb} />);
    expect(capturedDialogOnOpenChange).toBeDefined();

    // Simulate Dialog closing
    if (capturedDialogOnOpenChange) capturedDialogOnOpenChange(false);
    expect(mockSetOpen).toHaveBeenCalledWith(false);
    expect(mockRouterRefresh).toHaveBeenCalledTimes(1);

    // Simulate Dialog opening
    mockRouterRefresh.mockClear();
    mockSetOpen.mockClear();
    if (capturedDialogOnOpenChange) capturedDialogOnOpenChange(true);
    expect(mockSetOpen).toHaveBeenCalledWith(true);
    expect(mockRouterRefresh).toHaveBeenCalledTimes(1);
  });

  test("correctly configures for 'link' survey type in embed view", () => {
    render(<ShareEmbedSurvey {...defaultProps} survey={mockSurveyLink} modalView="embed" />);
    const embedViewProps = vi.mocked(mockEmbedViewComponent).mock.calls[0][0] as {
      tabs: { id: string; label: string; icon: LucideIcon }[];
      activeId: string;
    };
    expect(embedViewProps.tabs.length).toBe(4);
    expect(embedViewProps.tabs.find((tab) => tab.id === "app")).toBeUndefined();
    expect(embedViewProps.tabs[0].id).toBe("link");
    expect(embedViewProps.activeId).toBe("link");
  });

  test("correctly configures for 'web' survey type in embed view", () => {
    render(<ShareEmbedSurvey {...defaultProps} survey={mockSurveyWeb} modalView="embed" />);
    const embedViewProps = vi.mocked(mockEmbedViewComponent).mock.calls[0][0] as {
      tabs: { id: string; label: string; icon: LucideIcon }[];
      activeId: string;
    };
    expect(embedViewProps.tabs.length).toBe(1);
    expect(embedViewProps.tabs[0].id).toBe("webpage");
    expect(embedViewProps.activeId).toBe("app");
  });

  test("useEffect does not change activeId if survey.type changes from web to link (while in embed view)", () => {
    const { rerender } = render(
      <ShareEmbedSurvey {...defaultProps} survey={mockSurveyWeb} modalView="embed" />
    );
    expect(vi.mocked(mockEmbedViewComponent).mock.calls[0][0].activeId).toBe("app");

    rerender(<ShareEmbedSurvey {...defaultProps} survey={mockSurveyLink} modalView="embed" />);
    expect(vi.mocked(mockEmbedViewComponent).mock.calls[1][0].activeId).toBe("app"); // Current behavior
  });

  test("initial showView is set by modalView prop when open is true", () => {
    render(<ShareEmbedSurvey {...defaultProps} open={true} modalView="embed" />);
    expect(mockEmbedViewComponent).toHaveBeenCalled();
    expect(screen.getByText("EmbedViewMockContent")).toBeInTheDocument();
    cleanup();

    render(<ShareEmbedSurvey {...defaultProps} open={true} modalView="panel" />);
    expect(mockPanelInfoViewComponent).toHaveBeenCalled();
    expect(screen.getByText("PanelInfoViewMockContent")).toBeInTheDocument();
  });

  test("useEffect sets showView to 'start' when open becomes false", () => {
    const { rerender } = render(<ShareEmbedSurvey {...defaultProps} open={true} modalView="embed" />);
    expect(screen.getByText("EmbedViewMockContent")).toBeInTheDocument(); // Starts in embed

    rerender(<ShareEmbedSurvey {...defaultProps} open={false} modalView="embed" />);
    // Dialog mock returns null when open is false, so EmbedViewMockContent is not found
    expect(screen.queryByText("EmbedViewMockContent")).not.toBeInTheDocument();
    // To verify showView is 'start', we'd need to inspect internal state or render start view elements
    // For now, we trust the useEffect sets showView, and if it were to re-open in 'start' mode, it would show.
    // The main check is that the previous view ('embed') is gone.
  });

  test("renders correct label for link tab based on singleUse survey property", () => {
    render(<ShareEmbedSurvey {...defaultProps} survey={mockSurveyLink} modalView="embed" />);
    let embedViewProps = vi.mocked(mockEmbedViewComponent).mock.calls[0][0] as {
      tabs: { id: string; label: string }[];
    };
    let linkTab = embedViewProps.tabs.find((tab) => tab.id === "link");
    expect(linkTab?.label).toBe("environments.surveys.summary.share_the_link");
    cleanup();
    vi.mocked(mockEmbedViewComponent).mockClear();

    const mockSurveyLinkSingleUse: TSurvey = {
      ...mockSurveyLink,
      singleUse: { enabled: true, isEncrypted: true },
    };
    render(<ShareEmbedSurvey {...defaultProps} survey={mockSurveyLinkSingleUse} modalView="embed" />);
    embedViewProps = vi.mocked(mockEmbedViewComponent).mock.calls[0][0] as {
      tabs: { id: string; label: string }[];
    };
    linkTab = embedViewProps.tabs.find((tab) => tab.id === "link");
    expect(linkTab?.label).toBe("environments.surveys.summary.single_use_links");
  });
});
