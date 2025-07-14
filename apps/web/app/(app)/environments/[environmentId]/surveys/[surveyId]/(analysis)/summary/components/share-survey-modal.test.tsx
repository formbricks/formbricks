import { ShareSurveyModal } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/components/share-survey-modal";
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

const mockShareViewComponent = vi.fn();
vi.mock("./shareEmbedModal/share-view", () => ({
  ShareView: (props: any) => mockShareViewComponent(props),
}));

// Mock getSurveyUrl to return a predictable URL
vi.mock("@/modules/analysis/utils", () => ({
  getSurveyUrl: vi.fn().mockResolvedValue("https://public-domain.com/s/survey1"),
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
    modalView: "start" as "start" | "share",
    setOpen: mockSetOpen,
    user: mockUser,
    segments: [],
    isContactsEnabled: true,
    isFormbricksCloud: true,
  };

  beforeEach(() => {
    mockShareViewComponent.mockImplementation(
      ({ tabs, activeId, survey, email, surveyUrl, publicDomain, locale }) => (
        <div>
          <div data-testid="shareview-tabs">{JSON.stringify(tabs)}</div>
          <div data-testid="shareview-activeid">{activeId}</div>
          <div data-testid="shareview-survey-id">{survey.id}</div>
          <div data-testid="shareview-email">{email}</div>
          <div data-testid="shareview-surveyUrl">{surveyUrl}</div>
          <div data-testid="shareview-publicDomain">{publicDomain}</div>
          <div data-testid="shareview-locale">{locale}</div>
        </div>
      )
    );
  });

  test("renders initial 'start' view correctly when open and modalView is 'start' for link survey", () => {
    render(<ShareSurveyModal {...defaultProps} survey={mockSurveyLink} />);
    expect(screen.getByText("environments.surveys.summary.your_survey_is_public 🎉")).toBeInTheDocument();
    expect(screen.getByText("ShareSurveyLinkMock")).toBeInTheDocument();
    expect(screen.getByText("environments.surveys.summary.whats_next")).toBeInTheDocument();
    expect(screen.getByText("environments.surveys.summary.share_survey")).toBeInTheDocument();
    expect(screen.getByText("environments.surveys.summary.configure_alerts")).toBeInTheDocument();
    expect(screen.getByText("environments.surveys.summary.setup_integrations")).toBeInTheDocument();
    expect(screen.getByText("environments.surveys.summary.use_personal_links")).toBeInTheDocument();
    expect(screen.getByTestId("badge-mock")).toHaveTextContent("common.new");
  });

  test("renders initial 'start' view correctly when open and modalView is 'start' for app survey", () => {
    render(<ShareSurveyModal {...defaultProps} survey={mockSurveyWeb} />);
    // For app surveys, ShareSurveyLink should not be rendered
    expect(screen.queryByText("ShareSurveyLinkMock")).not.toBeInTheDocument();
    expect(screen.getByText("environments.surveys.summary.whats_next")).toBeInTheDocument();
    expect(screen.getByText("environments.surveys.summary.share_survey")).toBeInTheDocument();
    expect(screen.getByText("environments.surveys.summary.configure_alerts")).toBeInTheDocument();
    expect(screen.getByText("environments.surveys.summary.setup_integrations")).toBeInTheDocument();
    expect(screen.getByText("environments.surveys.summary.use_personal_links")).toBeInTheDocument();
    expect(screen.getByTestId("badge-mock")).toHaveTextContent("common.new");
  });

  test("switches to 'embed' view when 'Embed survey' button is clicked", async () => {
    render(<ShareSurveyModal {...defaultProps} />);
    const embedButton = screen.getByText("environments.surveys.summary.share_survey");
    await userEvent.click(embedButton);
    expect(mockShareViewComponent).toHaveBeenCalled();
    expect(screen.getByTestId("shareview-tabs")).toBeInTheDocument();
  });

  test("handleOpenChange (when Dialog calls its onOpenChange prop)", () => {
    render(<ShareSurveyModal {...defaultProps} open={true} survey={mockSurveyWeb} />);
    expect(capturedDialogOnOpenChange).toBeDefined();

    // Simulate Dialog closing
    if (capturedDialogOnOpenChange) capturedDialogOnOpenChange(false);
    expect(mockSetOpen).toHaveBeenCalledWith(false);

    // Simulate Dialog opening
    mockSetOpen.mockClear();
    if (capturedDialogOnOpenChange) capturedDialogOnOpenChange(true);
    expect(mockSetOpen).toHaveBeenCalledWith(true);
  });

  test("correctly configures for 'link' survey type in embed view", () => {
    render(<ShareSurveyModal {...defaultProps} survey={mockSurveyLink} modalView="share" />);
    const embedViewProps = vi.mocked(mockShareViewComponent).mock.calls[0][0] as {
      tabs: { id: string; label: string; icon: LucideIcon }[];
      activeId: string;
    };
    expect(embedViewProps.tabs.length).toBe(5);
    expect(embedViewProps.tabs.find((tab) => tab.id === "app")).toBeUndefined();
    expect(embedViewProps.tabs.find((tab) => tab.id === "dynamic-popup")).toBeDefined();
    expect(embedViewProps.tabs.find((tab) => tab.id === "website-embed")).toBeDefined();
    expect(embedViewProps.tabs[0].id).toBe("link");
    expect(embedViewProps.activeId).toBe("link");
  });

  test("correctly configures for 'web' survey type in embed view", () => {
    render(<ShareSurveyModal {...defaultProps} survey={mockSurveyWeb} modalView="share" />);
    const embedViewProps = vi.mocked(mockShareViewComponent).mock.calls[0][0] as {
      tabs: { id: string; label: string; icon: LucideIcon }[];
      activeId: string;
    };
    expect(embedViewProps.tabs.length).toBe(1);
    expect(embedViewProps.tabs.find((tab) => tab.id === "app")).toBeDefined();
    expect(embedViewProps.tabs.find((tab) => tab.id === "website-embed")).toBeUndefined();
    expect(embedViewProps.tabs.find((tab) => tab.id === "dynamic-popup")).toBeUndefined();
    expect(embedViewProps.activeId).toBe("app");
  });

  test("useEffect does not change activeId if survey.type changes from web to link (while in embed view)", () => {
    const { rerender } = render(
      <ShareSurveyModal {...defaultProps} survey={mockSurveyWeb} modalView="share" />
    );
    expect(vi.mocked(mockShareViewComponent).mock.calls[0][0].activeId).toBe("app");

    rerender(<ShareSurveyModal {...defaultProps} survey={mockSurveyLink} modalView="share" />);
    expect(vi.mocked(mockShareViewComponent).mock.calls[1][0].activeId).toBe("app"); // Current behavior
  });

  test("initial showView is set by modalView prop when open is true", () => {
    render(<ShareSurveyModal {...defaultProps} open={true} modalView="share" />);
    expect(mockShareViewComponent).toHaveBeenCalled();
    expect(screen.getByTestId("shareview-tabs")).toBeInTheDocument();
    cleanup();

    render(<ShareSurveyModal {...defaultProps} open={true} modalView="start" />);
    // Start view shows the share survey button
    expect(screen.getByText("environments.surveys.summary.share_survey")).toBeInTheDocument();
  });

  test("useEffect sets showView to 'start' when open becomes false", () => {
    const { rerender } = render(<ShareSurveyModal {...defaultProps} open={true} modalView="share" />);
    expect(screen.getByTestId("shareview-tabs")).toBeInTheDocument(); // Starts in embed

    rerender(<ShareSurveyModal {...defaultProps} open={false} modalView="share" />);
    // Dialog mock returns null when open is false, so EmbedViewMockContent is not found
    expect(screen.queryByTestId("shareview-tabs")).not.toBeInTheDocument();
  });

  test("renders correct label for link tab based on singleUse survey property", () => {
    render(<ShareSurveyModal {...defaultProps} survey={mockSurveyLink} modalView="share" />);
    let embedViewProps = vi.mocked(mockShareViewComponent).mock.calls[0][0] as {
      tabs: { id: string; label: string }[];
    };
    let linkTab = embedViewProps.tabs.find((tab) => tab.id === "link");
    expect(linkTab?.label).toBe("environments.surveys.summary.share_the_link");
    cleanup();
    vi.mocked(mockShareViewComponent).mockClear();

    const mockSurveyLinkSingleUse: TSurvey = {
      ...mockSurveyLink,
      singleUse: { enabled: true, isEncrypted: true },
    };
    render(<ShareSurveyModal {...defaultProps} survey={mockSurveyLinkSingleUse} modalView="share" />);
    embedViewProps = vi.mocked(mockShareViewComponent).mock.calls[0][0] as {
      tabs: { id: string; label: string }[];
    };
    linkTab = embedViewProps.tabs.find((tab) => tab.id === "link");
    expect(linkTab?.label).toBe("environments.surveys.summary.single_use_links");
  });

  test("dynamic popup tab is only visible for link surveys", () => {
    // Test link survey includes dynamic popup tab
    render(<ShareSurveyModal {...defaultProps} survey={mockSurveyLink} modalView="share" />);
    let embedViewProps = vi.mocked(mockShareViewComponent).mock.calls[0][0] as {
      tabs: { id: string; label: string }[];
    };
    expect(embedViewProps.tabs.find((tab) => tab.id === "dynamic-popup")).toBeDefined();
    cleanup();
    vi.mocked(mockShareViewComponent).mockClear();

    // Test web survey excludes dynamic popup tab
    render(<ShareSurveyModal {...defaultProps} survey={mockSurveyWeb} modalView="share" />);
    embedViewProps = vi.mocked(mockShareViewComponent).mock.calls[0][0] as {
      tabs: { id: string; label: string }[];
    };
    expect(embedViewProps.tabs.find((tab) => tab.id === "dynamic-popup")).toBeUndefined();
  });

  test("website-embed and dynamic-popup tabs replace old webpage tab", () => {
    render(<ShareSurveyModal {...defaultProps} survey={mockSurveyLink} modalView="share" />);
    const embedViewProps = vi.mocked(mockShareViewComponent).mock.calls[0][0] as {
      tabs: { id: string; label: string }[];
    };
    expect(embedViewProps.tabs.find((tab) => tab.id === "webpage")).toBeUndefined();
    expect(embedViewProps.tabs.find((tab) => tab.id === "website-embed")).toBeDefined();
    expect(embedViewProps.tabs.find((tab) => tab.id === "dynamic-popup")).toBeDefined();
  });
});
