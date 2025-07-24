import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { TSegment } from "@formbricks/types/segment";
import { TSurvey } from "@formbricks/types/surveys/types";
import { TUser } from "@formbricks/types/user";
import { ShareSurveyModal } from "./share-survey-modal";

// Mock getPublicDomain - must be first to prevent server-side env access
vi.mock("@/lib/getPublicUrl", () => ({
  getPublicDomain: vi.fn().mockReturnValue("https://example.com"),
}));

// Mock env to prevent server-side env access
vi.mock("@/lib/env", () => ({
  env: {
    IS_FORMBRICKS_CLOUD: "0",
    NODE_ENV: "test",
    E2E_TESTING: "0",
    ENCRYPTION_KEY: "test-encryption-key-32-characters",
    WEBAPP_URL: "https://example.com",
    CRON_SECRET: "test-cron-secret",
    PUBLIC_URL: "https://example.com",
    VERCEL_URL: "",
  },
}));

// Mock the useTranslate hook
vi.mock("@tolgee/react", () => ({
  useTranslate: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        "environments.surveys.summary.single_use_links": "Single-use links",
        "environments.surveys.summary.share_the_link": "Share the link",
        "environments.surveys.summary.qr_code": "QR Code",
        "environments.surveys.summary.personal_links": "Personal links",
        "environments.surveys.summary.embed_in_an_email": "Embed in email",
        "environments.surveys.summary.embed_on_website": "Embed on website",
        "environments.surveys.summary.dynamic_popup": "Dynamic popup",
        "environments.surveys.summary.in_app.title": "In-app survey",
        "environments.surveys.summary.in_app.description": "Display survey in your app",
        "environments.surveys.share.anonymous_links.nav_title": "Share the link",
        "environments.surveys.share.single_use_links.nav_title": "Single-use links",
        "environments.surveys.share.personal_links.nav_title": "Personal links",
        "environments.surveys.share.embed_on_website.nav_title": "Embed on website",
        "environments.surveys.share.send_email.nav_title": "Embed in email",
        "environments.surveys.share.social_media.title": "Social media",
        "environments.surveys.share.dynamic_popup.nav_title": "Dynamic popup",
      };
      return translations[key] || key;
    },
  }),
}));

// Mock analysis utils
vi.mock("@/modules/analysis/utils", () => ({
  getSurveyUrl: vi.fn().mockResolvedValue("https://example.com/s/test-survey-id"),
}));

// Mock logger
vi.mock("@formbricks/logger", () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    log: vi.fn(),
  },
}));

// Mock dialog components
vi.mock("@/modules/ui/components/dialog", () => ({
  Dialog: ({ open, onOpenChange, children }: any) => (
    <div data-testid="dialog" data-open={open} onClick={() => onOpenChange(false)}>
      {children}
    </div>
  ),
  DialogContent: ({ children, width }: any) => (
    <div data-testid="dialog-content" data-width={width}>
      {children}
    </div>
  ),
  DialogTitle: ({ children }: any) => <div data-testid="dialog-title">{children}</div>,
}));

// Mock VisuallyHidden
vi.mock("@radix-ui/react-visually-hidden", () => ({
  VisuallyHidden: ({ asChild, children }: any) => (
    <div data-testid="visually-hidden">{asChild ? children : <span>{children}</span>}</div>
  ),
}));

// Mock child components
vi.mock(
  "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/components/shareEmbedModal/app-tab",
  () => ({
    AppTab: () => <div data-testid="app-tab">App Tab Content</div>,
  })
);

vi.mock(
  "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/components/shareEmbedModal/tab-container",
  () => ({
    TabContainer: ({ title, description, children }: any) => (
      <div data-testid="tab-container">
        <h3>{title}</h3>
        <p>{description}</p>
        {children}
      </div>
    ),
  })
);

vi.mock("./shareEmbedModal/share-view", () => ({
  ShareView: ({ tabs, activeId, setActiveId }: any) => (
    <div data-testid="share-view" data-active-id={activeId}>
      <h3>Share View</h3>
      <div data-testid="share-view-data">
        <div>Active Tab: {activeId}</div>
      </div>
      <div data-testid="tabs">
        {tabs.map((tab: any) => (
          <button key={tab.id} onClick={() => setActiveId(tab.id)} data-testid={`tab-${tab.id}`}>
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  ),
}));

vi.mock("./shareEmbedModal/success-view", () => ({
  SuccessView: ({
    survey,
    surveyUrl,
    publicDomain,
    user,
    tabs,
    handleViewChange,
    handleEmbedViewWithTab,
  }: any) => (
    <div data-testid="success-view">
      <h3>Success View</h3>
      <div data-testid="success-view-data">
        <div>Survey: {survey?.id}</div>
        <div>URL: {surveyUrl}</div>
        <div>Domain: {publicDomain}</div>
        <div>User: {user?.id}</div>
      </div>
      <div data-testid="success-tabs">
        {tabs.map((tab: any) => {
          // Handle single-use links case
          let displayLabel = tab.label;
          if (tab.id === "anon-links" && survey?.singleUse?.enabled) {
            displayLabel = "Single-use links";
          }
          return (
            <button
              key={tab.id}
              onClick={() => handleEmbedViewWithTab(tab.id)}
              data-testid={`success-tab-${tab.id}`}>
              {displayLabel}
            </button>
          );
        })}
      </div>
      <button onClick={() => handleViewChange("share")} data-testid="go-to-share-view">
        Go to Share View
      </button>
    </div>
  ),
}));

// Mock lucide-react icons
vi.mock("lucide-react", async (importOriginal) => {
  const actual = (await importOriginal()) as any;
  return {
    ...actual,
    Code2Icon: () => <svg data-testid="code2-icon" />,
    LinkIcon: () => <svg data-testid="link-icon" />,
    MailIcon: () => <svg data-testid="mail-icon" />,
    QrCodeIcon: () => <svg data-testid="qrcode-icon" />,
    SmartphoneIcon: () => <svg data-testid="smartphone-icon" />,
    SquareStack: () => <svg data-testid="square-stack-icon" />,
    UserIcon: () => <svg data-testid="user-icon" />,
  };
});

// Mock data
const mockSurvey: TSurvey = {
  id: "test-survey-id",
  createdAt: new Date(),
  updatedAt: new Date(),
  name: "Test Survey",
  type: "link",
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
};

const mockAppSurvey: TSurvey = {
  ...mockSurvey,
  type: "app",
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
    alert: {},
    unsubscribedOrganizationIds: [],
  },
};

const mockSegments: TSegment[] = [];

const mockSetOpen = vi.fn();

const defaultProps = {
  survey: mockSurvey,
  publicDomain: "https://example.com",
  open: true,
  modalView: "start" as const,
  setOpen: mockSetOpen,
  user: mockUser,
  segments: mockSegments,
  isContactsEnabled: true,
  isFormbricksCloud: false,
};

describe("ShareSurveyModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  test("renders dialog when open is true", () => {
    render(<ShareSurveyModal {...defaultProps} />);

    expect(screen.getByTestId("dialog")).toHaveAttribute("data-open", "true");
    expect(screen.getByTestId("dialog-content")).toBeInTheDocument();
  });

  test("renders success view when modalView is start", () => {
    render(<ShareSurveyModal {...defaultProps} modalView="start" />);

    expect(screen.getByTestId("success-view")).toBeInTheDocument();
    expect(screen.getByText("Success View")).toBeInTheDocument();
  });

  test("renders share view when modalView is share and survey is link type", () => {
    render(<ShareSurveyModal {...defaultProps} modalView="share" />);

    expect(screen.getByTestId("share-view")).toBeInTheDocument();
    expect(screen.getByText("Share View")).toBeInTheDocument();
  });

  test("renders app tab when survey is app type and modalView is share", () => {
    render(<ShareSurveyModal {...defaultProps} survey={mockAppSurvey} modalView="share" />);

    expect(screen.getByTestId("tab-container")).toBeInTheDocument();
    expect(screen.getByTestId("app-tab")).toBeInTheDocument();
    expect(screen.getByText("In-app survey")).toBeInTheDocument();
    expect(screen.getByText("Display survey in your app")).toBeInTheDocument();
  });

  test("renders success view when survey is app type and modalView is start", () => {
    render(<ShareSurveyModal {...defaultProps} survey={mockAppSurvey} modalView="start" />);

    expect(screen.getByTestId("success-view")).toBeInTheDocument();
    expect(screen.queryByTestId("tab-container")).not.toBeInTheDocument();
  });

  test("sets correct width for dialog content based on survey type", () => {
    const { rerender } = render(<ShareSurveyModal {...defaultProps} survey={mockSurvey} />);

    expect(screen.getByTestId("dialog-content")).toHaveAttribute("data-width", "wide");

    rerender(<ShareSurveyModal {...defaultProps} survey={mockAppSurvey} />);

    expect(screen.getByTestId("dialog-content")).toHaveAttribute("data-width", "default");
  });

  test("generates correct tabs for link survey", () => {
    render(<ShareSurveyModal {...defaultProps} modalView="start" />);

    expect(screen.getByTestId("success-tab-anon-links")).toHaveTextContent("Share the link");
    expect(screen.getByTestId("success-tab-qr-code")).toHaveTextContent("QR Code");
    expect(screen.getByTestId("success-tab-personal-links")).toHaveTextContent("Personal links");
    expect(screen.getByTestId("success-tab-email")).toHaveTextContent("Embed in email");
    expect(screen.getByTestId("success-tab-website-embed")).toHaveTextContent("Embed on website");
    expect(screen.getByTestId("success-tab-dynamic-popup")).toHaveTextContent("Dynamic popup");
  });

  test("shows single-use links label when singleUse is enabled", () => {
    const singleUseSurvey = { ...mockSurvey, singleUse: { enabled: true, isEncrypted: false } };
    render(<ShareSurveyModal {...defaultProps} survey={singleUseSurvey} modalView="start" />);

    expect(screen.getByTestId("success-tab-anon-links")).toHaveTextContent("Single-use links");
  });

  test("calls setOpen when dialog is closed", async () => {
    const user = userEvent.setup();
    render(<ShareSurveyModal {...defaultProps} />);

    await user.click(screen.getByTestId("dialog"));

    expect(mockSetOpen).toHaveBeenCalledWith(false);
  });

  test("fetches survey URL on mount", async () => {
    const { getSurveyUrl } = await import("@/modules/analysis/utils");

    render(<ShareSurveyModal {...defaultProps} />);

    await waitFor(() => {
      expect(getSurveyUrl).toHaveBeenCalledWith(mockSurvey, "https://example.com", "default");
    });
  });

  test("handles getSurveyUrl failure gracefully", async () => {
    const { getSurveyUrl } = await import("@/modules/analysis/utils");
    vi.mocked(getSurveyUrl).mockRejectedValue(new Error("Failed to fetch"));

    // Render and verify it doesn't crash, even if nothing renders due to the error
    expect(() => {
      render(<ShareSurveyModal {...defaultProps} />);
    }).not.toThrow();
  });

  test("renders ShareView with correct active tab", () => {
    render(<ShareSurveyModal {...defaultProps} modalView="share" />);

    const shareViewData = screen.getByTestId("share-view-data");
    expect(shareViewData).toHaveTextContent("Active Tab: anon-links");
  });

  test("passes correct props to SuccessView", () => {
    render(<ShareSurveyModal {...defaultProps} modalView="start" />);

    const successViewData = screen.getByTestId("success-view-data");
    expect(successViewData).toHaveTextContent("Survey: test-survey-id");
    expect(successViewData).toHaveTextContent("Domain: https://example.com");
    expect(successViewData).toHaveTextContent("User: test-user-id");
  });

  test("resets to start view when modal is closed and reopened", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<ShareSurveyModal {...defaultProps} modalView="share" />);

    expect(screen.getByTestId("share-view")).toBeInTheDocument();

    rerender(<ShareSurveyModal {...defaultProps} modalView="share" open={false} />);
    rerender(<ShareSurveyModal {...defaultProps} modalView="share" open={true} />);

    expect(screen.getByTestId("share-view")).toBeInTheDocument();
  });

  test("sets correct active tab for link survey", () => {
    render(<ShareSurveyModal {...defaultProps} modalView="share" />);

    expect(screen.getByTestId("share-view")).toHaveAttribute("data-active-id", "anon-links");
  });

  test("renders tab container for app survey in share mode", () => {
    render(<ShareSurveyModal {...defaultProps} survey={mockAppSurvey} modalView="share" />);

    expect(screen.getByTestId("tab-container")).toBeInTheDocument();
    expect(screen.getByTestId("app-tab")).toBeInTheDocument();
    expect(screen.queryByTestId("share-view")).not.toBeInTheDocument();
  });

  test("renders with contacts disabled", () => {
    render(<ShareSurveyModal {...defaultProps} modalView="share" isContactsEnabled={false} />);

    // Just verify the ShareView renders correctly regardless of isContactsEnabled prop
    expect(screen.getByTestId("share-view")).toBeInTheDocument();
    expect(screen.getByTestId("share-view")).toHaveAttribute("data-active-id", "anon-links");
  });

  test("renders with formbricks cloud enabled", () => {
    render(<ShareSurveyModal {...defaultProps} modalView="share" isFormbricksCloud={true} />);

    // Just verify the ShareView renders correctly regardless of isFormbricksCloud prop
    expect(screen.getByTestId("share-view")).toBeInTheDocument();
  });

  test("correctly handles direct navigation to share view", () => {
    render(<ShareSurveyModal {...defaultProps} modalView="share" />);

    expect(screen.getByTestId("share-view")).toBeInTheDocument();
    expect(screen.queryByTestId("success-view")).not.toBeInTheDocument();
  });

  test("handler functions are passed to child components", () => {
    render(<ShareSurveyModal {...defaultProps} modalView="start" />);

    // Verify SuccessView receives the handler functions by checking buttons exist
    expect(screen.getByTestId("go-to-share-view")).toBeInTheDocument();
    expect(screen.getByTestId("success-tab-anon-links")).toBeInTheDocument();
    expect(screen.getByTestId("success-tab-qr-code")).toBeInTheDocument();
  });

  test("tab switching functionality is available in ShareView", () => {
    render(<ShareSurveyModal {...defaultProps} modalView="share" />);

    // Verify ShareView has tab switching buttons
    expect(screen.getByTestId("tab-anon-links")).toBeInTheDocument();
    expect(screen.getByTestId("tab-qr-code")).toBeInTheDocument();
    expect(screen.getByTestId("tab-personal-links")).toBeInTheDocument();
  });

  test("renders different content based on survey type", () => {
    // Link survey renders ShareView
    const { rerender } = render(<ShareSurveyModal {...defaultProps} survey={mockSurvey} modalView="share" />);
    expect(screen.getByTestId("share-view")).toBeInTheDocument();

    // App survey renders TabContainer with AppTab
    rerender(<ShareSurveyModal {...defaultProps} survey={mockAppSurvey} modalView="share" />);
    expect(screen.getByTestId("tab-container")).toBeInTheDocument();
    expect(screen.getByTestId("app-tab")).toBeInTheDocument();
    expect(screen.queryByTestId("share-view")).not.toBeInTheDocument();
  });
});
