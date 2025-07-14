import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { TSurvey, TSurveyQuestionTypeEnum } from "@formbricks/types/surveys/types";
import { ShareView } from "./share-view";

// Mock child components
vi.mock("./AppTab", () => ({
  AppTab: () => <div data-testid="app-tab">AppTab Content</div>,
}));
vi.mock("./EmailTab", () => ({
  EmailTab: (props: { surveyId: string; email: string }) => (
    <div data-testid="email-tab">
      EmailTab Content for {props.surveyId} with {props.email}
    </div>
  ),
}));
vi.mock("./LinkTab", () => ({
  LinkTab: (props: { survey: any; surveyUrl: string }) => (
    <div data-testid="link-tab">
      LinkTab Content for {props.survey.id} at {props.surveyUrl}
    </div>
  ),
}));
vi.mock("./WebsiteEmbedTab", () => ({
  WebsiteEmbedTab: (props: { surveyUrl: string }) => (
    <div data-testid="website-embed-tab">WebsiteEmbedTab Content for {props.surveyUrl}</div>
  ),
}));
vi.mock("./DynamicPopupTab", () => ({
  DynamicPopupTab: (props: { environmentId: string; surveyId: string }) => (
    <div data-testid="dynamic-popup-tab">
      DynamicPopupTab Content for {props.surveyId} in {props.environmentId}
    </div>
  ),
}));
vi.mock("./TabContainer", () => ({
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

vi.mock("@/modules/ui/components/upgrade-prompt", () => ({
  UpgradePrompt: (props: { title: string; description: string }) => (
    <div data-testid="upgrade-prompt">
      {props.title} - {props.description}
    </div>
  ),
}));

// Mock lucide-react
vi.mock("lucide-react", () => ({
  ArrowLeftIcon: () => <div data-testid="arrow-left-icon">ArrowLeftIcon</div>,
  MailIcon: () => <div data-testid="mail-icon">MailIcon</div>,
  LinkIcon: () => <div data-testid="link-icon">LinkIcon</div>,
  GlobeIcon: () => <div data-testid="globe-icon">GlobeIcon</div>,
  SmartphoneIcon: () => <div data-testid="smartphone-icon">SmartphoneIcon</div>,
  CheckCircle2Icon: () => <div data-testid="check-circle-2-icon">CheckCircle2Icon</div>,
  AlertCircle: ({ className }: { className?: string }) => (
    <div className={className} data-testid="alert-circle">
      AlertCircle
    </div>
  ),
  AlertTriangle: ({ className }: { className?: string }) => (
    <div className={className} data-testid="alert-triangle">
      AlertTriangle
    </div>
  ),
  Info: ({ className }: { className?: string }) => (
    <div className={className} data-testid="info">
      Info
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

const mockTabs = [
  { id: "email", label: "Email", icon: () => <div data-testid="email-tab-icon" /> },
  { id: "website-embed", label: "Website Embed", icon: () => <div data-testid="website-embed-tab-icon" /> },
  { id: "dynamic-popup", label: "Dynamic Popup", icon: () => <div data-testid="dynamic-popup-tab-icon" /> },
  { id: "link", label: "Link", icon: () => <div data-testid="link-tab-icon" /> },
  { id: "app", label: "App", icon: () => <div data-testid="app-tab-icon" /> },
];

// Create proper mock survey objects
const createMockSurvey = (type: "link" | "app", id = "survey1"): TSurvey => ({
  id,
  createdAt: new Date(),
  updatedAt: new Date(),
  name: `Test Survey ${id}`,
  type,
  environmentId: "env1",
  createdBy: "user123",
  status: "inProgress",
  displayOption: "displayOnce",
  autoClose: null,
  triggers: [],
  recontactDays: null,
  displayLimit: null,
  welcomeCard: {
    enabled: false,
    headline: { default: "" },
    html: { default: "" },
    fileUrl: undefined,
    buttonLabel: { default: "" },
    timeToFinish: false,
    showResponseCount: false,
  },
  questions: [
    {
      id: "q1",
      type: TSurveyQuestionTypeEnum.OpenText,
      headline: { default: "Test Question" },
      subheader: { default: "" },
      required: true,
      inputType: "text",
      placeholder: { default: "" },
      longAnswer: false,
      logic: [],
      charLimit: { enabled: false },
      buttonLabel: { default: "" },
      backButtonLabel: { default: "" },
    },
  ],
  endings: [
    {
      id: "end1",
      type: "endScreen",
      headline: { default: "Thank you!" },
      subheader: { default: "" },
      buttonLabel: { default: "" },
      buttonLink: undefined,
    },
  ],
  hiddenFields: { enabled: false, fieldIds: [] },
  variables: [],
  followUps: [],
  delay: 0,
  autoComplete: null,
  runOnDate: null,
  closeOnDate: null,
  projectOverwrites: null,
  styling: null,
  showLanguageSwitch: null,
  surveyClosedMessage: null,
  segment: null,
  singleUse: null,
  isVerifyEmailEnabled: false,
  recaptcha: null,
  isSingleResponsePerEmailEnabled: false,
  isBackButtonHidden: false,
  pin: null,
  resultShareKey: null,
  displayPercentage: null,
  languages: [
    {
      enabled: true,
      default: true,
      language: {
        id: "lang1",
        createdAt: new Date(),
        updatedAt: new Date(),
        code: "en",
        alias: "English",
        projectId: "project1",
      },
    },
  ],
});

const mockSurveyLink = createMockSurvey("link", "survey1");
const mockSurveyApp = createMockSurvey("app", "survey2");

const defaultProps = {
  tabs: mockTabs,
  activeId: "email",
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
    render(<ShareView {...defaultProps} survey={mockSurveyApp} />);

    // For non-link survey types, desktop sidebar should not be rendered
    // Check that SidebarProvider is not rendered by looking for sidebar-specific elements
    const sidebarLabel = screen.queryByText("Share via");
    expect(sidebarLabel).toBeNull();
  });

  test("renders desktop tabs for link survey type", () => {
    render(<ShareView {...defaultProps} survey={mockSurveyLink} />);

    // For link survey types, desktop sidebar should be rendered
    const sidebarLabel = screen.getByText("Share via");
    expect(sidebarLabel).toBeInTheDocument();
  });

  test("calls setActiveId when a tab is clicked (desktop)", async () => {
    render(<ShareView {...defaultProps} survey={mockSurveyLink} activeId="email" />);

    const websiteEmbedTabButton = screen.getByLabelText("Website Embed");
    await userEvent.click(websiteEmbedTabButton);
    expect(defaultProps.setActiveId).toHaveBeenCalledWith("website-embed");
  });

  test("renders EmailTab when activeId is 'email'", () => {
    render(<ShareView {...defaultProps} activeId="email" />);
    expect(screen.getByTestId("email-tab")).toBeInTheDocument();
    expect(
      screen.getByText(`EmailTab Content for ${defaultProps.survey.id} with ${defaultProps.email}`)
    ).toBeInTheDocument();
  });

  test("renders WebsiteEmbedTab when activeId is 'website-embed'", () => {
    render(<ShareView {...defaultProps} activeId="website-embed" />);
    expect(screen.getByTestId("tab-container")).toBeInTheDocument();
    expect(screen.getByTestId("website-embed-tab")).toBeInTheDocument();
    expect(screen.getByText(`WebsiteEmbedTab Content for ${defaultProps.surveyUrl}`)).toBeInTheDocument();
  });

  test("renders DynamicPopupTab when activeId is 'dynamic-popup'", () => {
    render(<ShareView {...defaultProps} activeId="dynamic-popup" />);
    expect(screen.getByTestId("tab-container")).toBeInTheDocument();
    expect(screen.getByTestId("dynamic-popup-tab")).toBeInTheDocument();
    expect(
      screen.getByText(
        `DynamicPopupTab Content for ${defaultProps.survey.id} in ${defaultProps.environmentId}`
      )
    ).toBeInTheDocument();
  });

  test("renders LinkTab when activeId is 'link'", () => {
    render(<ShareView {...defaultProps} activeId="link" />);
    expect(screen.getByTestId("link-tab")).toBeInTheDocument();
    expect(
      screen.getByText(`LinkTab Content for ${defaultProps.survey.id} at ${defaultProps.surveyUrl}`)
    ).toBeInTheDocument();
  });

  test("renders AppTab when activeId is 'app'", () => {
    render(<ShareView {...defaultProps} activeId="app" />);
    expect(screen.getByTestId("app-tab")).toBeInTheDocument();
  });

  test("renders PersonalLinksTab when activeId is 'personal-links'", () => {
    render(<ShareView {...defaultProps} activeId="personal-links" />);
    expect(screen.getByTestId("personal-links-tab")).toBeInTheDocument();
    expect(
      screen.getByText(
        `PersonalLinksTab Content for ${defaultProps.survey.id} in ${defaultProps.environmentId}`
      )
    ).toBeInTheDocument();
  });

  test("calls setActiveId when a responsive tab is clicked", async () => {
    render(<ShareView {...defaultProps} survey={mockSurveyLink} activeId="email" />);

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
      expect(defaultProps.setActiveId).toHaveBeenCalledWith("website-embed");
    }
  });

  test("applies active styles to the active tab (desktop)", () => {
    render(<ShareView {...defaultProps} survey={mockSurveyLink} activeId="email" />);

    const emailTabButton = screen.getByLabelText("Email");
    expect(emailTabButton).toHaveClass("bg-slate-100");
    expect(emailTabButton).toHaveClass("font-medium");
    expect(emailTabButton).toHaveClass("text-slate-900");

    const websiteEmbedTabButton = screen.getByLabelText("Website Embed");
    expect(websiteEmbedTabButton).not.toHaveClass("bg-slate-100");
    expect(websiteEmbedTabButton).not.toHaveClass("font-medium");
  });

  test("applies active styles to the active tab (responsive)", () => {
    render(<ShareView {...defaultProps} survey={mockSurveyLink} activeId="email" />);

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
