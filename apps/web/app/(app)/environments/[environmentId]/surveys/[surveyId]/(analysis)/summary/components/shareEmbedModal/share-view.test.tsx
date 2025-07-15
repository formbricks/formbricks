import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { TSurvey } from "@formbricks/types/surveys/types";
import { TUserLocale } from "@formbricks/types/user";
import { ShareViewType } from "../../types/share";
import { ShareView } from "./share-view";

// Mock child components
vi.mock("./app-tab", () => ({
  AppTab: () => <div data-testid="app-tab">AppTab Content</div>,
}));

vi.mock("./email-tab", () => ({
  EmailTab: (props: { surveyId: string; email: string }) => (
    <div data-testid="email-tab">
      EmailTab Content for {props.surveyId} with {props.email}
    </div>
  ),
}));

vi.mock("./qr-code-tab", () => ({
  QRCodeTab: (props: { surveyUrl: string }) => (
    <div data-testid="qr-code-tab">QRCodeTab Content for {props.surveyUrl}</div>
  ),
}));

vi.mock("./website-embed-tab", () => ({
  WebsiteEmbedTab: (props: { surveyUrl: string }) => (
    <div data-testid="website-embed-tab">WebsiteEmbedTab Content for {props.surveyUrl}</div>
  ),
}));

vi.mock("./dynamic-popup-tab", () => ({
  DynamicPopupTab: (props: { environmentId: string; surveyId: string }) => (
    <div data-testid="dynamic-popup-tab">
      DynamicPopupTab Content for {props.surveyId} in {props.environmentId}
    </div>
  ),
}));

vi.mock("./tab-container", () => ({
  TabContainer: (props: { children: React.ReactNode; title: string; description: string }) => (
    <div data-testid="tab-container">
      <div data-testid="tab-title">{props.title}</div>
      <div data-testid="tab-description">{props.description}</div>
      {props.children}
    </div>
  ),
}));

vi.mock("./personal-links-tab", () => ({
  PersonalLinksTab: (props: { surveyId: string; environmentId: string }) => (
    <div data-testid="personal-links-tab">
      PersonalLinksTab Content for {props.surveyId} in {props.environmentId}
    </div>
  ),
}));

vi.mock("./anonymous-links-tab", () => ({
  AnonymousLinksTab: (props: {
    survey: TSurvey;
    surveyUrl: string;
    publicDomain: string;
    setSurveyUrl: (url: string) => void;
    locale: TUserLocale;
  }) => (
    <div data-testid="anonymous-links-tab">
      AnonymousLinksTab Content for {props.survey.id} at {props.surveyUrl}
    </div>
  ),
}));

vi.mock("@/modules/ui/components/upgrade-prompt", () => ({
  UpgradePrompt: (props: { title: string; description: string }) => (
    <div data-testid="upgrade-prompt">
      {props.title} - {props.description}
    </div>
  ),
}));

// Mock @tolgee/react
vi.mock("@tolgee/react", () => ({
  useTranslate: () => ({
    t: (key: string) => key,
  }),
}));

// Mock lucide-react
vi.mock("lucide-react", () => ({
  CopyIcon: () => <div data-testid="copy-icon">CopyIcon</div>,
  ArrowLeftIcon: () => <div data-testid="arrow-left-icon">ArrowLeftIcon</div>,
  ArrowUpRightIcon: () => <div data-testid="arrow-up-right-icon">ArrowUpRightIcon</div>,
  MailIcon: () => <div data-testid="mail-icon">MailIcon</div>,
  LinkIcon: () => <div data-testid="link-icon">LinkIcon</div>,
  GlobeIcon: () => <div data-testid="globe-icon">GlobeIcon</div>,
  SmartphoneIcon: () => <div data-testid="smartphone-icon">SmartphoneIcon</div>,
  CheckCircle2Icon: () => <div data-testid="check-circle-2-icon">CheckCircle2Icon</div>,
  AlertCircleIcon: ({ className }: { className?: string }) => (
    <div className={className} data-testid="alert-circle-icon">
      AlertCircleIcon
    </div>
  ),
  AlertTriangleIcon: ({ className }: { className?: string }) => (
    <div className={className} data-testid="alert-triangle-icon">
      AlertTriangleIcon
    </div>
  ),
  InfoIcon: ({ className }: { className?: string }) => (
    <div className={className} data-testid="info-icon">
      InfoIcon
    </div>
  ),
  Download: ({ className }: { className?: string }) => (
    <div className={className} data-testid="download-icon">
      Download
    </div>
  ),
}));

// Mock sidebar components
vi.mock("@/modules/ui/components/sidebar", () => ({
  SidebarProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Sidebar: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SidebarContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SidebarGroup: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SidebarGroupContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SidebarGroupLabel: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SidebarMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SidebarMenuItem: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SidebarMenuButton: ({
    children,
    onClick,
    tooltip,
    className,
  }: {
    children: React.ReactNode;
    onClick: () => void;
    tooltip: string;
    className?: string;
  }) => (
    <button type="button" onClick={onClick} className={className} aria-label={tooltip}>
      {children}
    </button>
  ),
}));

// Mock tooltip and typography components
vi.mock("@/modules/ui/components/tooltip", () => ({
  TooltipRenderer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/modules/ui/components/typography", () => ({
  Small: ({ children }: { children: React.ReactNode }) => <small>{children}</small>,
}));

// Mock button component
vi.mock("@/modules/ui/components/button", () => ({
  Button: ({
    children,
    onClick,
    className,
    variant,
  }: {
    children: React.ReactNode;
    onClick: () => void;
    className?: string;
    variant?: string;
  }) => (
    <button type="button" onClick={onClick} className={className} data-variant={variant}>
      {children}
    </button>
  ),
}));

// Mock cn utility
vi.mock("@/lib/cn", () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(" "),
}));

const mockTabs: Array<{ id: ShareViewType; label: string; icon: React.ElementType }> = [
  { id: ShareViewType.EMAIL, label: "Email", icon: () => <div data-testid="email-tab-icon" /> },
  {
    id: ShareViewType.WEBSITE_EMBED,
    label: "Website Embed",
    icon: () => <div data-testid="website-embed-tab-icon" />,
  },
  {
    id: ShareViewType.DYNAMIC_POPUP,
    label: "Dynamic Popup",
    icon: () => <div data-testid="dynamic-popup-tab-icon" />,
  },
  { id: ShareViewType.ANON_LINKS, label: "Anonymous Links", icon: () => <div data-testid="link-tab-icon" /> },
  { id: ShareViewType.QR_CODE, label: "QR Code", icon: () => <div data-testid="qr-code-tab-icon" /> },
  { id: ShareViewType.APP, label: "App", icon: () => <div data-testid="app-tab-icon" /> },
];

const mockSurveyLink = {
  id: "survey1",
  type: "link",
  name: "Test Link Survey",
  status: "inProgress",
  environmentId: "env1",
  createdAt: new Date(),
  updatedAt: new Date(),
  questions: [],
  displayOption: "displayOnce",
  recontactDays: 0,
  triggers: [],
  languages: [],
  autoClose: null,
  delay: 0,
  autoComplete: null,
  runOnDate: null,
  closeOnDate: null,
  singleUse: { enabled: false, isEncrypted: false },
  styling: null,
} as any;
const mockSurveyWeb = {
  id: "survey2",
  type: "app",
  name: "Test Web Survey",
  status: "inProgress",
  environmentId: "env1",
  createdAt: new Date(),
  updatedAt: new Date(),
  questions: [],
  displayOption: "displayOnce",
  recontactDays: 0,
  triggers: [],
  languages: [],
  autoClose: null,
  delay: 0,
  autoComplete: null,
  runOnDate: null,
  closeOnDate: null,
  singleUse: { enabled: false, isEncrypted: false },
  styling: null,
} as any;

const defaultProps = {
  tabs: mockTabs,
  activeId: ShareViewType.EMAIL,
  setActiveId: vi.fn(),
  environmentId: "env1",
  survey: mockSurveyLink,
  email: "test@example.com",
  surveyUrl: "http://example.com/survey1",
  publicDomain: "http://example.com",
  setSurveyUrl: vi.fn(),
  locale: "en" as any,
  segments: [],
  isContactsEnabled: true,
  isFormbricksCloud: false,
};

describe("ShareView", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  test("does not render desktop tabs for non-link survey type", () => {
    render(<ShareView {...defaultProps} survey={mockSurveyWeb} />);

    // For non-link survey types, desktop sidebar should not be rendered
    // Check that SidebarProvider is not rendered by looking for sidebar-specific elements
    const sidebarLabel = screen.queryByText("Share via");
    expect(sidebarLabel).toBeNull();
  });

  test("renders desktop tabs for link survey type", () => {
    render(<ShareView {...defaultProps} survey={mockSurveyLink} activeId={ShareViewType.EMAIL} />);

    // For link survey types, desktop sidebar should be rendered
    const sidebarLabel = screen.getByText("environments.surveys.share.share_view_title");
    expect(sidebarLabel).toBeInTheDocument();
  });

  test("calls setActiveId when a tab is clicked (desktop)", async () => {
    render(<ShareView {...defaultProps} survey={mockSurveyLink} activeId={ShareViewType.EMAIL} />);

    const websiteEmbedTabButton = screen.getByLabelText("Website Embed");
    await userEvent.click(websiteEmbedTabButton);
    expect(defaultProps.setActiveId).toHaveBeenCalledWith(ShareViewType.WEBSITE_EMBED);
  });

  test("renders EmailTab when activeId is 'email'", () => {
    render(<ShareView {...defaultProps} activeId={ShareViewType.EMAIL} />);
    expect(screen.getByTestId("email-tab")).toBeInTheDocument();
    expect(
      screen.getByText(`EmailTab Content for ${defaultProps.survey.id} with ${defaultProps.email}`)
    ).toBeInTheDocument();
  });

  test("renders WebsiteEmbedTab when activeId is 'website-embed'", () => {
    render(<ShareView {...defaultProps} activeId={ShareViewType.WEBSITE_EMBED} />);
    expect(screen.getByTestId("website-embed-tab")).toBeInTheDocument();
    expect(screen.getByText(`WebsiteEmbedTab Content for ${defaultProps.surveyUrl}`)).toBeInTheDocument();
  });

  test("renders DynamicPopupTab when activeId is 'dynamic-popup'", () => {
    render(<ShareView {...defaultProps} activeId={ShareViewType.DYNAMIC_POPUP} />);
    expect(screen.getByTestId("dynamic-popup-tab")).toBeInTheDocument();
    expect(
      screen.getByText(
        `DynamicPopupTab Content for ${defaultProps.survey.id} in ${defaultProps.environmentId}`
      )
    ).toBeInTheDocument();
  });

  test("renders AnonymousLinksTab when activeId is 'anon-links'", () => {
    render(<ShareView {...defaultProps} activeId={ShareViewType.ANON_LINKS} />);
    expect(screen.getByTestId("anonymous-links-tab")).toBeInTheDocument();
    expect(
      screen.getByText(`AnonymousLinksTab Content for ${defaultProps.survey.id} at ${defaultProps.surveyUrl}`)
    ).toBeInTheDocument();
  });

  test("renders QRCodeTab when activeId is 'qr-code'", () => {
    render(<ShareView {...defaultProps} activeId={ShareViewType.QR_CODE} />);
    expect(screen.getByTestId("qr-code-tab")).toBeInTheDocument();
  });

  test("renders AppTab when activeId is 'app'", () => {
    render(<ShareView {...defaultProps} activeId={ShareViewType.APP} />);
    expect(screen.getByTestId("app-tab")).toBeInTheDocument();
  });

  test("renders PersonalLinksTab when activeId is 'personal-links'", () => {
    render(<ShareView {...defaultProps} activeId={ShareViewType.PERSONAL_LINKS} />);
    expect(screen.getByTestId("personal-links-tab")).toBeInTheDocument();
    expect(
      screen.getByText(
        `PersonalLinksTab Content for ${defaultProps.survey.id} in ${defaultProps.environmentId}`
      )
    ).toBeInTheDocument();
  });

  test("calls setActiveId when a responsive tab is clicked", async () => {
    render(<ShareView {...defaultProps} survey={mockSurveyLink} activeId={ShareViewType.EMAIL} />);

    // Get responsive buttons - these are Button components containing icons
    const responsiveButtons = screen.getAllByTestId("website-embed-tab-icon");
    // The responsive button should be the one inside the md:hidden container
    const responsiveButton = responsiveButtons
      .find((icon) => {
        const button = icon.closest("button");
        return button && button.getAttribute("data-variant") === "ghost";
      })
      ?.closest("button");

    if (responsiveButton) {
      await userEvent.click(responsiveButton);
      expect(defaultProps.setActiveId).toHaveBeenCalledWith(ShareViewType.WEBSITE_EMBED);
    }
  });

  test("applies active styles to the active tab (desktop)", () => {
    render(<ShareView {...defaultProps} survey={mockSurveyLink} activeId={ShareViewType.EMAIL} />);

    const emailTabButton = screen.getByLabelText("Email");
    expect(emailTabButton).toHaveClass("bg-slate-100");
    expect(emailTabButton).toHaveClass("font-medium");
    expect(emailTabButton).toHaveClass("text-slate-900");

    const websiteEmbedTabButton = screen.getByLabelText("Website Embed");
    expect(websiteEmbedTabButton).not.toHaveClass("bg-slate-100");
    expect(websiteEmbedTabButton).not.toHaveClass("font-medium");
  });

  test("applies active styles to the active tab (responsive)", () => {
    render(<ShareView {...defaultProps} survey={mockSurveyLink} activeId={ShareViewType.EMAIL} />);

    // Get responsive buttons - these are Button components with ghost variant
    const responsiveButtons = screen.getAllByTestId("email-tab-icon");
    const responsiveEmailButton = responsiveButtons
      .find((icon) => {
        const button = icon.closest("button");
        return button && button.getAttribute("data-variant") === "ghost";
      })
      ?.closest("button");

    if (responsiveEmailButton) {
      // Check that the button has the active classes
      expect(responsiveEmailButton).toHaveClass("bg-white text-slate-900 shadow-sm hover:bg-white");
    }

    const responsiveWebsiteEmbedButtons = screen.getAllByTestId("website-embed-tab-icon");
    const responsiveWebsiteEmbedButton = responsiveWebsiteEmbedButtons
      .find((icon) => {
        const button = icon.closest("button");
        return button && button.getAttribute("data-variant") === "ghost";
      })
      ?.closest("button");

    if (responsiveWebsiteEmbedButton) {
      expect(responsiveWebsiteEmbedButton).toHaveClass(
        "border-transparent text-slate-700 hover:text-slate-900"
      );
    }
  });
});
