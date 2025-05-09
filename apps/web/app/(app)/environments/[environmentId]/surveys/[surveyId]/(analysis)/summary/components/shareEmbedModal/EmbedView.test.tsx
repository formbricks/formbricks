import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { EmbedView } from "./EmbedView";

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
vi.mock("./WebsiteTab", () => ({
  WebsiteTab: (props: { surveyUrl: string; environmentId: string }) => (
    <div data-testid="website-tab">
      WebsiteTab Content for {props.surveyUrl} in {props.environmentId}
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
  ArrowLeftIcon: () => <div data-testid="arrow-left-icon">ArrowLeftIcon</div>,
  MailIcon: () => <div data-testid="mail-icon">MailIcon</div>,
  LinkIcon: () => <div data-testid="link-icon">LinkIcon</div>,
  GlobeIcon: () => <div data-testid="globe-icon">GlobeIcon</div>,
  SmartphoneIcon: () => <div data-testid="smartphone-icon">SmartphoneIcon</div>,
}));

const mockTabs = [
  { id: "email", label: "Email", icon: () => <div data-testid="email-tab-icon" /> },
  { id: "webpage", label: "Web Page", icon: () => <div data-testid="webpage-tab-icon" /> },
  { id: "link", label: "Link", icon: () => <div data-testid="link-tab-icon" /> },
  { id: "app", label: "App", icon: () => <div data-testid="app-tab-icon" /> },
];

const mockSurveyLink = { id: "survey1", type: "link" };
const mockSurveyWeb = { id: "survey2", type: "web" };

const defaultProps = {
  handleInitialPageButton: vi.fn(),
  tabs: mockTabs,
  activeId: "email",
  setActiveId: vi.fn(),
  environmentId: "env1",
  survey: mockSurveyLink,
  email: "test@example.com",
  surveyUrl: "http://example.com/survey1",
  surveyDomain: "http://example.com",
  setSurveyUrl: vi.fn(),
  locale: "en" as any,
  disableBack: false,
};

describe("EmbedView", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  test("does not render back button when disableBack is true", () => {
    render(<EmbedView {...defaultProps} disableBack={true} />);
    expect(screen.queryByRole("button", { name: "common.back" })).not.toBeInTheDocument();
  });

  test("does not render desktop tabs for non-link survey type", () => {
    render(<EmbedView {...defaultProps} survey={mockSurveyWeb} />);
    // Desktop tabs container should not be present or not have lg:flex if it's a common parent
    const desktopTabsButtons = screen.queryAllByRole("button", { name: /Email|Web Page|Link|App/i });
    // Check if any of these buttons are part of a container that is only visible on large screens
    const desktopTabContainer = desktopTabsButtons[0]?.closest("div.lg\\:flex");
    expect(desktopTabContainer).toBeNull();
  });

  test("calls setActiveId when a tab is clicked (desktop)", async () => {
    render(<EmbedView {...defaultProps} survey={mockSurveyLink} activeId="email" />);
    const webpageTabButton = screen.getAllByRole("button", { name: "Web Page" })[0]; // First one is desktop
    await userEvent.click(webpageTabButton);
    expect(defaultProps.setActiveId).toHaveBeenCalledWith("webpage");
  });

  test("renders EmailTab when activeId is 'email'", () => {
    render(<EmbedView {...defaultProps} activeId="email" />);
    expect(screen.getByTestId("email-tab")).toBeInTheDocument();
    expect(
      screen.getByText(`EmailTab Content for ${defaultProps.survey.id} with ${defaultProps.email}`)
    ).toBeInTheDocument();
  });

  test("renders WebsiteTab when activeId is 'webpage'", () => {
    render(<EmbedView {...defaultProps} activeId="webpage" />);
    expect(screen.getByTestId("website-tab")).toBeInTheDocument();
    expect(
      screen.getByText(`WebsiteTab Content for ${defaultProps.surveyUrl} in ${defaultProps.environmentId}`)
    ).toBeInTheDocument();
  });

  test("renders LinkTab when activeId is 'link'", () => {
    render(<EmbedView {...defaultProps} activeId="link" />);
    expect(screen.getByTestId("link-tab")).toBeInTheDocument();
    expect(
      screen.getByText(`LinkTab Content for ${defaultProps.survey.id} at ${defaultProps.surveyUrl}`)
    ).toBeInTheDocument();
  });

  test("renders AppTab when activeId is 'app'", () => {
    render(<EmbedView {...defaultProps} activeId="app" />);
    expect(screen.getByTestId("app-tab")).toBeInTheDocument();
  });

  test("calls setActiveId when a responsive tab is clicked", async () => {
    render(<EmbedView {...defaultProps} survey={mockSurveyLink} activeId="email" />);
    // Get the responsive tab button (second instance of the button with this name)
    const responsiveWebpageTabButton = screen.getAllByRole("button", { name: "Web Page" })[1];
    await userEvent.click(responsiveWebpageTabButton);
    expect(defaultProps.setActiveId).toHaveBeenCalledWith("webpage");
  });

  test("applies active styles to the active tab (desktop)", () => {
    render(<EmbedView {...defaultProps} survey={mockSurveyLink} activeId="email" />);
    const emailTabButton = screen.getAllByRole("button", { name: "Email" })[0];
    expect(emailTabButton).toHaveClass("border-slate-200 bg-slate-100 font-semibold text-slate-900");

    const webpageTabButton = screen.getAllByRole("button", { name: "Web Page" })[0];
    expect(webpageTabButton).toHaveClass("border-transparent text-slate-500 hover:text-slate-700");
  });

  test("applies active styles to the active tab (responsive)", () => {
    render(<EmbedView {...defaultProps} survey={mockSurveyLink} activeId="email" />);
    const responsiveEmailTabButton = screen.getAllByRole("button", { name: "Email" })[1];
    expect(responsiveEmailTabButton).toHaveClass("bg-white text-slate-900 shadow-sm");

    const responsiveWebpageTabButton = screen.getAllByRole("button", { name: "Web Page" })[1];
    expect(responsiveWebpageTabButton).toHaveClass("border-transparent text-slate-700 hover:text-slate-900");
  });
});
