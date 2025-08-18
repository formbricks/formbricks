import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { TSurvey } from "@formbricks/types/surveys/types";
import { TUserLocale } from "@formbricks/types/user";
import { LinkTabsType, ShareSettingsType, ShareViaType } from "../../types/share";
import { ShareView } from "./share-view";

// Mock sidebar components
vi.mock("@/modules/ui/components/sidebar", () => ({
  SidebarProvider: ({ children, open, className, style }: any) => (
    <div data-testid="sidebar-provider" data-open={open} className={className} style={style}>
      {children}
    </div>
  ),
  Sidebar: ({ children }: { children: React.ReactNode }) => <div data-testid="sidebar">{children}</div>,
  SidebarContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="sidebar-content">{children}</div>
  ),
  SidebarGroup: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="sidebar-group">{children}</div>
  ),
  SidebarGroupContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="sidebar-group-content">{children}</div>
  ),
  SidebarGroupLabel: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="sidebar-group-label">{children}</div>
  ),
  SidebarMenu: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="sidebar-menu">{children}</div>
  ),
  SidebarMenuItem: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="sidebar-menu-item">{children}</div>
  ),
  SidebarMenuButton: ({
    children,
    onClick,
    tooltip,
    className,
    isActive,
  }: {
    children: React.ReactNode;
    onClick: () => void;
    tooltip: string;
    className?: string;
    isActive?: boolean;
  }) => (
    <button type="button" onClick={onClick} className={className} aria-label={tooltip} data-active={isActive}>
      {children}
    </button>
  ),
}));

// Mock child components
vi.mock("./EmailTab", () => ({
  EmailTab: (props: { surveyId: string; email: string }) => (
    <div data-testid="email-tab">
      EmailTab Content for {props.surveyId} with {props.email}
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

vi.mock("./social-media-tab", () => ({
  SocialMediaTab: (props: { surveyUrl: string; surveyTitle: string }) => (
    <div data-testid="social-media-tab">
      SocialMediaTab Content for {props.surveyTitle} at {props.surveyUrl}
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
  Code2Icon: () => <div data-testid="code2-icon">Code2Icon</div>,
  QrCodeIcon: () => <div data-testid="qr-code-icon">QrCodeIcon</div>,
  Share2Icon: () => <div data-testid="share2-icon">Share2Icon</div>,
  SquareStack: () => <div data-testid="square-stack-icon">SquareStack</div>,
  UserIcon: () => <div data-testid="user-icon">UserIcon</div>,
  Settings: () => <div data-testid="settings-icon">Settings</div>,
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

// Mock i18n
vi.mock("@tolgee/react", () => ({
  useTranslate: () => ({
    t: (key: string) => key,
  }),
}));

// Mock component imports for tabs
const MockEmailTab = ({ surveyId, email }: { surveyId: string; email: string }) => (
  <div data-testid="email-tab">
    EmailTab Content for {surveyId} with {email}
  </div>
);

const MockAnonymousLinksTab = ({ survey, surveyUrl }: { survey: any; surveyUrl: string }) => (
  <div data-testid="anonymous-links-tab">
    AnonymousLinksTab Content for {survey.id} at {surveyUrl}
  </div>
);

const MockWebsiteEmbedTab = ({ surveyUrl }: { surveyUrl: string }) => (
  <div data-testid="website-embed-tab">WebsiteEmbedTab Content for {surveyUrl}</div>
);

const MockDynamicPopupTab = ({ environmentId, surveyId }: { environmentId: string; surveyId: string }) => (
  <div data-testid="dynamic-popup-tab">
    DynamicPopupTab Content for {surveyId} in {environmentId}
  </div>
);

const MockQRCodeTab = ({ surveyUrl }: { surveyUrl: string }) => (
  <div data-testid="qr-code-tab">QRCodeTab Content for {surveyUrl}</div>
);

const MockPersonalLinksTab = ({ surveyId, environmentId }: { surveyId: string; environmentId: string }) => (
  <div data-testid="personal-links-tab">
    PersonalLinksTab Content for {surveyId} in {environmentId}
  </div>
);

const MockSocialMediaTab = ({ surveyUrl, surveyTitle }: { surveyUrl: string; surveyTitle: string }) => (
  <div data-testid="social-media-tab">
    SocialMediaTab Content for {surveyTitle} at {surveyUrl}
  </div>
);

const mockSurvey = {
  id: "survey1",
  type: "link",
  name: "Test Survey",
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

// Mock LinkSettingsTab
const MockLinkSettingsTab = ({
  survey,
  isReadOnly,
  locale,
}: {
  survey: any;
  isReadOnly: boolean;
  locale: string;
}) => (
  <div data-testid="link-settings-tab">
    LinkSettingsTab Content for {survey.id} - ReadOnly: {isReadOnly.toString()} - Locale: {locale}
  </div>
);

const mockTabs = [
  {
    id: ShareViaType.EMAIL,
    type: LinkTabsType.SHARE_VIA,
    label: "Email",
    icon: () => <div data-testid="email-tab-icon" />,
    componentType: MockEmailTab,
    componentProps: { surveyId: "survey1", email: "test@example.com" },
    title: "Send Email",
    description: "Send survey via email",
  },
  {
    id: ShareViaType.WEBSITE_EMBED,
    type: LinkTabsType.SHARE_VIA,
    label: "Website Embed",
    icon: () => <div data-testid="website-embed-tab-icon" />,
    componentType: MockWebsiteEmbedTab,
    componentProps: { surveyUrl: "http://example.com/survey1" },
    title: "Embed on Website",
    description: "Embed survey on your website",
  },
  {
    id: ShareViaType.DYNAMIC_POPUP,
    type: LinkTabsType.SHARE_VIA,
    label: "Dynamic Popup",
    icon: () => <div data-testid="dynamic-popup-tab-icon" />,
    componentType: MockDynamicPopupTab,
    componentProps: { environmentId: "env1", surveyId: "survey1" },
    title: "Dynamic Popup",
    description: "Show survey as popup",
  },
  {
    id: ShareViaType.ANON_LINKS,
    type: LinkTabsType.SHARE_VIA,
    label: "Anonymous Links",
    icon: () => <div data-testid="anonymous-links-tab-icon" />,
    componentType: MockAnonymousLinksTab,
    componentProps: {
      survey: mockSurvey,
      surveyUrl: "http://example.com/survey1",
      publicDomain: "http://example.com",
      setSurveyUrl: vi.fn(),
      locale: "en" as any,
    },
    title: "Anonymous Links",
    description: "Share anonymous links",
  },
  {
    id: ShareViaType.QR_CODE,
    type: LinkTabsType.SHARE_VIA,
    label: "QR Code",
    icon: () => <div data-testid="qr-code-tab-icon" />,
    componentType: MockQRCodeTab,
    componentProps: { surveyUrl: "http://example.com/survey1" },
    title: "QR Code",
    description: "Generate QR code",
  },
  {
    id: ShareViaType.PERSONAL_LINKS,
    type: LinkTabsType.SHARE_VIA,
    label: "Personal Links",
    icon: () => <div data-testid="personal-links-tab-icon" />,
    componentType: MockPersonalLinksTab,
    componentProps: { surveyId: "survey1", environmentId: "env1" },
    title: "Personal Links",
    description: "Create personal links",
  },
  {
    id: ShareViaType.SOCIAL_MEDIA,
    type: LinkTabsType.SHARE_VIA,
    label: "Social Media",
    icon: () => <div data-testid="social-media-tab-icon" />,
    componentType: MockSocialMediaTab,
    componentProps: { surveyUrl: "http://example.com/survey1", surveyTitle: "Test Survey" },
    title: "Social Media",
    description: "Share on social media",
  },
  {
    id: ShareSettingsType.LINK_SETTINGS,
    type: LinkTabsType.SHARE_SETTING,
    label: "Link Settings",
    icon: () => <div data-testid="link-settings-tab-icon" />,
    componentType: MockLinkSettingsTab,
    componentProps: { survey: mockSurvey, isReadOnly: false, locale: "en-US" },
    title: "Link Settings",
    description: "Configure link settings",
  },
];

const defaultProps = {
  tabs: mockTabs,
  activeId: ShareViaType.EMAIL,
  setActiveId: vi.fn(),
};

// Mock window object for resize testing
Object.defineProperty(window, "innerWidth", {
  writable: true,
  configurable: true,
  value: 1024,
});

describe("ShareView", () => {
  beforeEach(() => {
    // Reset window size to default before each test
    window.innerWidth = 1024;
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  test("renders sidebar with tabs", () => {
    render(<ShareView {...defaultProps} />);

    // Sidebar should always be rendered
    const sidebarLabel = screen.getByText("environments.surveys.share.share_view_title");
    expect(sidebarLabel).toBeInTheDocument();
  });

  test("renders desktop tabs", () => {
    render(<ShareView {...defaultProps} activeId={ShareViaType.EMAIL} />);

    // Desktop sidebar should be rendered
    const sidebarLabel = screen.getByText("environments.surveys.share.share_view_title");
    expect(sidebarLabel).toBeInTheDocument();
  });

  test("renders share settings section", () => {
    render(<ShareView {...defaultProps} />);

    // Share settings section should be rendered
    const shareSettingsLabel = screen.getByText("environments.surveys.share.share_settings_title");
    expect(shareSettingsLabel).toBeInTheDocument();
  });

  test("calls setActiveId when a tab is clicked (desktop)", async () => {
    render(<ShareView {...defaultProps} activeId={ShareViaType.EMAIL} />);

    const websiteEmbedTabButton = screen.getByLabelText("Website Embed");
    await userEvent.click(websiteEmbedTabButton);
    expect(defaultProps.setActiveId).toHaveBeenCalledWith(ShareViaType.WEBSITE_EMBED);
  });

  test("renders EmailTab when activeId is EMAIL", () => {
    render(<ShareView {...defaultProps} activeId={ShareViaType.EMAIL} />);
    expect(screen.getByTestId("email-tab")).toBeInTheDocument();
    expect(screen.getByText("EmailTab Content for survey1 with test@example.com")).toBeInTheDocument();
  });

  test("renders WebsiteEmbedTab when activeId is WEBSITE_EMBED", () => {
    render(<ShareView {...defaultProps} activeId={ShareViaType.WEBSITE_EMBED} />);
    expect(screen.getByTestId("tab-container")).toBeInTheDocument();
    expect(screen.getByTestId("website-embed-tab")).toBeInTheDocument();
    expect(screen.getByText("WebsiteEmbedTab Content for http://example.com/survey1")).toBeInTheDocument();
  });

  test("renders DynamicPopupTab when activeId is DYNAMIC_POPUP", () => {
    render(<ShareView {...defaultProps} activeId={ShareViaType.DYNAMIC_POPUP} />);
    expect(screen.getByTestId("tab-container")).toBeInTheDocument();
    expect(screen.getByTestId("dynamic-popup-tab")).toBeInTheDocument();
    expect(screen.getByText("DynamicPopupTab Content for survey1 in env1")).toBeInTheDocument();
  });

  test("renders AnonymousLinksTab when activeId is ANON_LINKS", () => {
    render(<ShareView {...defaultProps} activeId={ShareViaType.ANON_LINKS} />);
    expect(screen.getByTestId("anonymous-links-tab")).toBeInTheDocument();
    expect(
      screen.getByText("AnonymousLinksTab Content for survey1 at http://example.com/survey1")
    ).toBeInTheDocument();
  });

  test("renders QRCodeTab when activeId is QR_CODE", () => {
    render(<ShareView {...defaultProps} activeId={ShareViaType.QR_CODE} />);
    expect(screen.getByTestId("qr-code-tab")).toBeInTheDocument();
  });

  test("renders LinkSettingsTab when activeId is LINK_SETTINGS", () => {
    render(<ShareView {...defaultProps} activeId={ShareSettingsType.LINK_SETTINGS} />);
    expect(screen.getByTestId("link-settings-tab")).toBeInTheDocument();
    expect(
      screen.getByText("LinkSettingsTab Content for survey1 - ReadOnly: false - Locale: en-US")
    ).toBeInTheDocument();
  });

  test("renders nothing when activeId doesn't match any tab", () => {
    // Create a special case with no matching tab
    const propsWithNoMatchingTab = {
      ...defaultProps,
      tabs: mockTabs.slice(0, 3), // Only include first 3 tabs
      activeId: ShareViaType.SOCIAL_MEDIA, // Use a tab not in the subset
    };

    render(<ShareView {...propsWithNoMatchingTab} />);

    // Should not render any tab content for non-matching activeId
    expect(screen.queryByTestId("email-tab")).not.toBeInTheDocument();
    expect(screen.queryByTestId("website-embed-tab")).not.toBeInTheDocument();
    expect(screen.queryByTestId("dynamic-popup-tab")).not.toBeInTheDocument();
    expect(screen.queryByTestId("anonymous-links-tab")).not.toBeInTheDocument();
    expect(screen.queryByTestId("qr-code-tab")).not.toBeInTheDocument();
    expect(screen.queryByTestId("personal-links-tab")).not.toBeInTheDocument();
    expect(screen.queryByTestId("social-media-tab")).not.toBeInTheDocument();
    expect(screen.queryByTestId("link-settings-tab")).not.toBeInTheDocument();
  });

  test("renders PersonalLinksTab when activeId is PERSONAL_LINKS", () => {
    render(<ShareView {...defaultProps} activeId={ShareViaType.PERSONAL_LINKS} />);
    expect(screen.getByTestId("personal-links-tab")).toBeInTheDocument();
    expect(screen.getByText("PersonalLinksTab Content for survey1 in env1")).toBeInTheDocument();
  });

  test("renders SocialMediaTab when activeId is SOCIAL_MEDIA", () => {
    render(<ShareView {...defaultProps} activeId={ShareViaType.SOCIAL_MEDIA} />);
    expect(screen.getByTestId("social-media-tab")).toBeInTheDocument();
    expect(
      screen.getByText("SocialMediaTab Content for Test Survey at http://example.com/survey1")
    ).toBeInTheDocument();
  });

  test("calls setActiveId when a responsive tab is clicked", async () => {
    render(<ShareView {...defaultProps} activeId={ShareViaType.EMAIL} />);

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
      expect(defaultProps.setActiveId).toHaveBeenCalledWith(ShareViaType.WEBSITE_EMBED);
    }
  });

  test("applies active styles to the active tab (desktop)", () => {
    render(<ShareView {...defaultProps} activeId={ShareViaType.EMAIL} />);

    const emailTabButton = screen.getByLabelText("Email");
    expect(emailTabButton).toHaveClass("bg-slate-100");
    expect(emailTabButton).toHaveClass("font-medium");
    expect(emailTabButton).toHaveClass("text-slate-900");

    const websiteEmbedTabButton = screen.getByLabelText("Website Embed");
    expect(websiteEmbedTabButton).not.toHaveClass("bg-slate-100");
    expect(websiteEmbedTabButton).not.toHaveClass("font-medium");
  });

  test("applies active styles to the active tab (responsive)", () => {
    render(<ShareView {...defaultProps} activeId={ShareViaType.EMAIL} />);

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

  test("renders all tabs from props", () => {
    render(<ShareView {...defaultProps} />);

    // Check that all tabs are rendered in the sidebar
    mockTabs.forEach((tab) => {
      expect(screen.getByLabelText(tab.label)).toBeInTheDocument();
    });
  });

  test("renders responsive buttons for all tabs", () => {
    render(<ShareView {...defaultProps} />);

    // Check that responsive buttons are rendered for all tabs
    const expectedTestIds = [
      "email-tab-icon",
      "website-embed-tab-icon",
      "dynamic-popup-tab-icon",
      "anonymous-links-tab-icon",
      "qr-code-tab-icon",
      "personal-links-tab-icon",
      "social-media-tab-icon",
      "link-settings-tab-icon",
    ];

    expectedTestIds.forEach((testId) => {
      const responsiveButtons = screen.getAllByTestId(testId);
      const responsiveButton = responsiveButtons.find((icon) => {
        const button = icon.closest("button");
        return button && button.getAttribute("data-variant") === "ghost";
      });
      expect(responsiveButton).toBeTruthy();
    });
  });

  test("separates share via and share settings tabs correctly", () => {
    render(<ShareView {...defaultProps} />);

    // Check that share via tabs are rendered
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Website Embed")).toBeInTheDocument();
    expect(screen.getByLabelText("Anonymous Links")).toBeInTheDocument();

    // Check that share settings tabs are rendered
    expect(screen.getByLabelText("Link Settings")).toBeInTheDocument();

    // Check that both sections have their titles
    expect(screen.getByText("environments.surveys.share.share_view_title")).toBeInTheDocument();
    expect(screen.getByText("environments.surveys.share.share_settings_title")).toBeInTheDocument();
  });

  test("calls setActiveId when a share settings tab is clicked", async () => {
    render(<ShareView {...defaultProps} activeId={ShareViaType.EMAIL} />);

    const linkSettingsTabButton = screen.getByLabelText("Link Settings");
    await userEvent.click(linkSettingsTabButton);
    expect(defaultProps.setActiveId).toHaveBeenCalledWith(ShareSettingsType.LINK_SETTINGS);
  });
});
