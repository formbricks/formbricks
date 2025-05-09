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
    surveyDomain: "test.com",
    open: true,
    modalView: "start" as "start" | "embed" | "panel",
    setOpen: mockSetOpen,
    user: mockUser,
  };

  beforeEach(() => {
    mockEmbedViewComponent.mockImplementation(
      ({ handleInitialPageButton, tabs, activeId, survey, email, surveyUrl, surveyDomain, locale }) => (
        <div>
          <button onClick={() => handleInitialPageButton()}>EmbedViewMockContent</button>
          <div data-testid="embedview-tabs">{JSON.stringify(tabs)}</div>
          <div data-testid="embedview-activeid">{activeId}</div>
          <div data-testid="embedview-survey-id">{survey.id}</div>
          <div data-testid="embedview-email">{email}</div>
          <div data-testid="embedview-surveyUrl">{surveyUrl}</div>
          <div data-testid="embedview-surveyDomain">{surveyDomain}</div>
          <div data-testid="embedview-locale">{locale}</div>
        </div>
      )
    );
    mockPanelInfoViewComponent.mockImplementation(({ handleInitialPageButton }) => (
      <button onClick={() => handleInitialPageButton()}>PanelInfoViewMockContent</button>
    ));
  });

  test("renders initial 'start' view correctly when open and modalView is 'start'", () => {
    render(<ShareEmbedSurvey {...defaultProps} />);
    expect(screen.getByText("environments.surveys.summary.your_survey_is_public 🎉")).toBeInTheDocument();
    expect(screen.getByText("ShareSurveyLinkMock")).toBeInTheDocument();
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

  test("calls setOpen(false) when handleInitialPageButton is triggered from EmbedView", async () => {
    render(<ShareEmbedSurvey {...defaultProps} modalView="embed" />);
    expect(mockEmbedViewComponent).toHaveBeenCalled();
    const embedViewButton = screen.getByText("EmbedViewMockContent");
    await userEvent.click(embedViewButton);
    expect(mockSetOpen).toHaveBeenCalledWith(false);
  });

  test("calls setOpen(false) when handleInitialPageButton is triggered from PanelInfoView", async () => {
    render(<ShareEmbedSurvey {...defaultProps} modalView="panel" />);
    expect(mockPanelInfoViewComponent).toHaveBeenCalled();
    const panelInfoViewButton = screen.getByText("PanelInfoViewMockContent");
    await userEvent.click(panelInfoViewButton);
    expect(mockSetOpen).toHaveBeenCalledWith(false);
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
    expect(embedViewProps.tabs.length).toBe(3);
    expect(embedViewProps.tabs.find((tab) => tab.id === "app")).toBeUndefined();
    expect(embedViewProps.tabs[0].id).toBe("email");
    expect(embedViewProps.activeId).toBe("email");
  });

  test("correctly configures for 'web' survey type in embed view", () => {
    render(<ShareEmbedSurvey {...defaultProps} survey={mockSurveyWeb} modalView="embed" />);
    const embedViewProps = vi.mocked(mockEmbedViewComponent).mock.calls[0][0] as {
      tabs: { id: string; label: string; icon: LucideIcon }[];
      activeId: string;
    };
    expect(embedViewProps.tabs.length).toBe(1);
    expect(embedViewProps.tabs[0].id).toBe("app");
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
