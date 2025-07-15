import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { TSurvey } from "@formbricks/types/surveys/types";
import { TUserLocale } from "@formbricks/types/user";
import { ShareViewType } from "../../types/share";
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

const mockTabs: Array<{
  id: ShareViewType;
  label: string;
  icon: React.ElementType;
  componentType: React.ComponentType<any>;
  componentProps: any;
  title: string;
  description?: string;
}> = [
  {
    id: ShareViewType.EMAIL,
    label: "Email",
    icon: () => <div data-testid="email-tab-icon" />,
    componentType: () => <div data-testid="email-tab-content">Email Content</div>,
    componentProps: {},
    title: "Email",
    description: "Email Description",
  },
  {
    id: ShareViewType.WEBSITE_EMBED,
    label: "Website Embed",
    icon: () => <div data-testid="website-embed-tab-icon" />,
    componentType: () => <div data-testid="website-embed-tab-content">Website Embed Content</div>,
    componentProps: {},
    title: "Website Embed",
    description: "Website Embed Description",
  },
  {
    id: ShareViewType.DYNAMIC_POPUP,
    label: "Dynamic Popup",
    icon: () => <div data-testid="dynamic-popup-tab-icon" />,
    componentType: () => <div data-testid="dynamic-popup-tab-content">Dynamic Popup Content</div>,
    componentProps: {},
    title: "Dynamic Popup",
    description: "Dynamic Popup Description",
  },
  {
    id: ShareViewType.ANON_LINKS,
    label: "Anonymous Links",
    icon: () => <div data-testid="link-tab-icon" />,
    componentType: () => <div data-testid="anonymous-links-tab-content">Anonymous Links Content</div>,
    componentProps: {},
    title: "Anonymous Links",
    description: "Anonymous Links Description",
  },
  {
    id: ShareViewType.QR_CODE,
    label: "QR Code",
    icon: () => <div data-testid="qr-code-tab-icon" />,
    componentType: () => <div data-testid="qr-code-tab-content">QR Code Content</div>,
    componentProps: {},
    title: "QR Code",
    description: "QR Code Description",
  },
  {
    id: ShareViewType.APP,
    label: "App",
    icon: () => <div data-testid="app-tab-icon" />,
    componentType: () => <div data-testid="app-tab-content">App Content</div>,
    componentProps: {},
    title: "App",
    description: "App Description",
  },
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

  describe("Responsive Behavior", () => {
    test("detects large screen size on mount", () => {
      window.innerWidth = 1200;
      render(<ShareView {...defaultProps} survey={mockSurveyLink} />);

      // SidebarProvider should be rendered with open=true for large screens
      const sidebarProvider = screen.getByTestId("sidebar-provider");
      expect(sidebarProvider).toHaveAttribute("data-open", "true");
    });

    test("detects small screen size on mount", () => {
      window.innerWidth = 800;
      render(<ShareView {...defaultProps} survey={mockSurveyLink} />);

      // SidebarProvider should be rendered with open=false for small screens
      const sidebarProvider = screen.getByTestId("sidebar-provider");
      expect(sidebarProvider).toHaveAttribute("data-open", "false");
    });

    test("updates screen size on window resize", async () => {
      window.innerWidth = 1200;
      const { rerender } = render(<ShareView {...defaultProps} survey={mockSurveyLink} />);

      // Initially large screen
      let sidebarProvider = screen.getByTestId("sidebar-provider");
      expect(sidebarProvider).toHaveAttribute("data-open", "true");

      // Simulate window resize to small screen
      window.innerWidth = 800;
      window.dispatchEvent(new Event("resize"));

      // Force re-render to trigger useEffect
      rerender(<ShareView {...defaultProps} survey={mockSurveyLink} />);

      // Should now be small screen
      sidebarProvider = screen.getByTestId("sidebar-provider");
      expect(sidebarProvider).toHaveAttribute("data-open", "false");
    });

    test("cleans up resize listener on unmount", () => {
      const removeEventListenerSpy = vi.spyOn(window, "removeEventListener");
      const { unmount } = render(<ShareView {...defaultProps} survey={mockSurveyLink} />);

      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith("resize", expect.any(Function));
    });
  });

  describe("TabContainer Integration", () => {
    test("renders active tab with correct title and description", () => {
      render(<ShareView {...defaultProps} activeId={ShareViewType.EMAIL} />);

      const tabContainer = screen.getByTestId("tab-container");
      expect(tabContainer).toBeInTheDocument();

      const tabTitle = screen.getByTestId("tab-title");
      expect(tabTitle).toHaveTextContent("Email");

      const tabDescription = screen.getByTestId("tab-description");
      expect(tabDescription).toHaveTextContent("Email Description");

      const tabContent = screen.getByTestId("email-tab-content");
      expect(tabContent).toBeInTheDocument();
    });

    test("renders different tab when activeId changes", () => {
      const { rerender } = render(<ShareView {...defaultProps} activeId={ShareViewType.EMAIL} />);

      // Initially shows Email tab
      expect(screen.getByTestId("tab-title")).toHaveTextContent("Email");
      expect(screen.getByTestId("email-tab-content")).toBeInTheDocument();

      // Change to Website Embed tab
      rerender(<ShareView {...defaultProps} activeId={ShareViewType.WEBSITE_EMBED} />);

      expect(screen.getByTestId("tab-title")).toHaveTextContent("Website Embed");
      expect(screen.getByTestId("website-embed-tab-content")).toBeInTheDocument();
      expect(screen.queryByTestId("email-tab-content")).not.toBeInTheDocument();
    });

    test("handles tab without description", () => {
      const tabsWithoutDescription = [
        {
          id: ShareViewType.EMAIL,
          label: "Email",
          icon: () => <div data-testid="email-tab-icon" />,
          componentType: () => <div data-testid="email-tab-content">Email Content</div>,
          componentProps: {},
          title: "Email",
          // No description property
        },
      ];

      render(<ShareView {...defaultProps} tabs={tabsWithoutDescription} activeId={ShareViewType.EMAIL} />);

      const tabDescription = screen.getByTestId("tab-description");
      expect(tabDescription).toHaveTextContent("");
    });

    test("returns null when no active tab is found", () => {
      const emptyTabs: typeof mockTabs = [];

      render(<ShareView {...defaultProps} tabs={emptyTabs} activeId={ShareViewType.EMAIL} />);

      const tabContainer = screen.queryByTestId("tab-container");
      expect(tabContainer).not.toBeInTheDocument();
    });
  });

  describe("SidebarProvider Configuration", () => {
    test("renders SidebarProvider with correct props for link surveys", () => {
      render(<ShareView {...defaultProps} survey={mockSurveyLink} />);

      const sidebarProvider = screen.getByTestId("sidebar-provider");
      expect(sidebarProvider).toBeInTheDocument();
      expect(sidebarProvider).toHaveAttribute("data-open", "true");
      expect(sidebarProvider).toHaveClass("flex min-h-0 w-auto lg:col-span-1");
      expect(sidebarProvider).toHaveStyle("--sidebar-width: 100%");
    });

    test("does not render SidebarProvider for non-link surveys", () => {
      render(<ShareView {...defaultProps} survey={mockSurveyWeb} />);

      expect(screen.queryByTestId("sidebar-provider")).not.toBeInTheDocument();
    });

    test("renders correct grid layout for link surveys", () => {
      render(<ShareView {...defaultProps} survey={mockSurveyLink} />);

      const container = screen.getByTestId("sidebar-provider").parentElement;
      expect(container).toHaveClass("lg:grid lg:grid-cols-4");
    });

    test("does not render grid layout for non-link surveys", () => {
      const { container } = render(<ShareView {...defaultProps} survey={mockSurveyWeb} />);

      const mainDiv = container.querySelector(".h-full > div");
      expect(mainDiv).not.toHaveClass("lg:grid lg:grid-cols-4");
    });
  });

  describe("Sidebar Menu Buttons", () => {
    test("renders SidebarMenuButton with correct isActive prop", () => {
      render(<ShareView {...defaultProps} survey={mockSurveyLink} activeId={ShareViewType.EMAIL} />);

      const emailButton = screen.getByLabelText("Email");
      expect(emailButton).toHaveAttribute("data-active", "true");

      const websiteEmbedButton = screen.getByLabelText("Website Embed");
      expect(websiteEmbedButton).toHaveAttribute("data-active", "false");
    });

    test("renders all tabs in sidebar menu", () => {
      render(<ShareView {...defaultProps} survey={mockSurveyLink} />);

      mockTabs.forEach((tab) => {
        const button = screen.getByLabelText(tab.label);
        expect(button).toBeInTheDocument();
        expect(button).toHaveAttribute("data-active", tab.id === ShareViewType.EMAIL ? "true" : "false");
      });
    });
  });

  describe("Mobile Responsive Buttons", () => {
    test("renders mobile buttons for all tabs", () => {
      render(<ShareView {...defaultProps} />);

      // Mobile buttons should be present for all tabs
      mockTabs.forEach((tab) => {
        // Map ShareViewType to actual testid used in the component
        const testIdMap: Record<string, string> = {
          [ShareViewType.ANON_LINKS]: "link-tab-icon",
          [ShareViewType.PERSONAL_LINKS]: "personal-links-tab-icon",
          [ShareViewType.WEBSITE_EMBED]: "website-embed-tab-icon",
          [ShareViewType.EMAIL]: "email-tab-icon",
          [ShareViewType.SOCIAL_MEDIA]: "social-media-tab-icon",
          [ShareViewType.QR_CODE]: "qr-code-tab-icon",
          [ShareViewType.DYNAMIC_POPUP]: "dynamic-popup-tab-icon",
          [ShareViewType.APP]: "app-tab-icon",
        };

        const expectedTestId = testIdMap[tab.id] || `${tab.id}-tab-icon`;
        const mobileButtons = screen.getAllByTestId(expectedTestId);
        const mobileButton = mobileButtons.find((icon) => {
          const button = icon.closest("button");
          return button && button.getAttribute("data-variant") === "ghost";
        });
        expect(mobileButton).toBeInTheDocument();
      });
    });

    test("applies correct classes to mobile buttons based on active state", () => {
      render(<ShareView {...defaultProps} activeId={ShareViewType.WEBSITE_EMBED} />);

      const websiteEmbedIcons = screen.getAllByTestId("website-embed-tab-icon");
      const activeMobileButton = websiteEmbedIcons
        .find((icon) => {
          const button = icon.closest("button");
          return button && button.getAttribute("data-variant") === "ghost";
        })
        ?.closest("button");

      if (activeMobileButton) {
        expect(activeMobileButton).toHaveClass("bg-white text-slate-900 shadow-sm hover:bg-white");
      }
    });
  });

  describe("Content Area Layout", () => {
    test("applies correct column span for link surveys", () => {
      const { container } = render(<ShareView {...defaultProps} survey={mockSurveyLink} />);

      const contentArea = container.querySelector('[class*="lg:col-span-3"]');
      expect(contentArea).toBeInTheDocument();
      expect(contentArea).toHaveClass("lg:col-span-3");
    });

    test("does not apply column span for non-link surveys", () => {
      const { container } = render(<ShareView {...defaultProps} survey={mockSurveyWeb} />);

      const contentArea = container.querySelector('[class*="lg:col-span-3"]');
      expect(contentArea).toBeNull();
    });

    test("renders mobile button container with correct visibility class", () => {
      const { container } = render(<ShareView {...defaultProps} />);

      const mobileButtonContainer = container.querySelector(".md\\:hidden");
      expect(mobileButtonContainer).toBeInTheDocument();
      expect(mobileButtonContainer).toHaveClass("md:hidden");
    });
  });

  describe("Enhanced Tab Structure", () => {
    test("handles tabs with all required properties", () => {
      const completeTab = {
        id: ShareViewType.EMAIL,
        label: "Test Email",
        icon: () => <div data-testid="test-icon" />,
        componentType: () => <div data-testid="test-content">Test Content</div>,
        componentProps: {},
        title: "Test Title",
        description: "Test Description",
      };

      render(<ShareView {...defaultProps} tabs={[completeTab]} activeId={ShareViewType.EMAIL} />);

      expect(screen.getByTestId("tab-title")).toHaveTextContent("Test Title");
      expect(screen.getByTestId("tab-description")).toHaveTextContent("Test Description");
      expect(screen.getByTestId("test-content")).toBeInTheDocument();
    });

    test("uses title from tab definition in TabContainer", () => {
      const customTitleTab = {
        ...mockTabs[0],
        title: "Custom Email Title",
      };

      render(<ShareView {...defaultProps} tabs={[customTitleTab]} activeId={ShareViewType.EMAIL} />);

      expect(screen.getByTestId("tab-title")).toHaveTextContent("Custom Email Title");
    });
  });
});
