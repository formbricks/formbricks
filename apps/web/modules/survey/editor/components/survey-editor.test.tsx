import { TTeamPermission } from "@/modules/ee/teams/project-teams/types/team";
import { refetchProjectAction } from "@/modules/survey/editor/actions";
import { Environment, Language, OrganizationRole, Project } from "@prisma/client";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { TLanguage } from "@formbricks/types/project";
import { TSurvey, TSurveyOpenTextQuestion, TSurveyQuestionTypeEnum } from "@formbricks/types/surveys/types";
import { TUserLocale } from "@formbricks/types/user";
import { SurveyEditor } from "./survey-editor";

// Mock child components and hooks
vi.mock("@/lib/i18n/utils", () => ({
  extractLanguageCodes: vi.fn((langs) => langs.map((l) => l.language.code)),
  getEnabledLanguages: vi.fn((langs) => langs.filter((l) => l.enabled)),
}));
vi.mock("@/lib/pollyfills/structuredClone", () => ({
  structuredClone: vi.fn((obj) => JSON.parse(JSON.stringify(obj))),
}));
vi.mock("@/lib/useDocumentVisibility", () => ({
  useDocumentVisibility: vi.fn(),
}));
vi.mock("@/modules/survey/components/edit-public-survey-alert-dialog", () => ({
  EditPublicSurveyAlertDialog: vi.fn(({ open }) => (open ? <div>Edit Alert Dialog</div> : null)),
}));
vi.mock("@/modules/survey/editor/components/loading-skeleton", () => ({
  LoadingSkeleton: vi.fn(() => <div>Loading...</div>),
}));
vi.mock("@/modules/survey/editor/components/questions-view", () => ({
  QuestionsView: vi.fn(() => <div>Questions View</div>),
}));
vi.mock("@/modules/survey/editor/components/settings-view", () => ({
  SettingsView: vi.fn(() => <div>Settings View</div>),
}));
vi.mock("@/modules/survey/editor/components/styling-view", () => ({
  StylingView: vi.fn(() => <div>Styling View</div>),
}));
vi.mock("@/modules/survey/editor/components/survey-editor-tabs", () => ({
  SurveyEditorTabs: vi.fn(({ activeId, setActiveId, isStylingTabVisible, isSurveyFollowUpsAllowed }) => (
    <div>
      <button onClick={() => setActiveId("questions")}>Questions Tab</button>
      {isStylingTabVisible && <button onClick={() => setActiveId("styling")}>Styling Tab</button>}
      <button onClick={() => setActiveId("settings")}>Settings Tab</button>
      {isSurveyFollowUpsAllowed && <button onClick={() => setActiveId("followUps")}>Follow-ups Tab</button>}
      <div>Active Tab: {activeId}</div>
    </div>
  )),
}));
vi.mock("@/modules/survey/editor/components/survey-menu-bar", () => ({
  SurveyMenuBar: vi.fn(({ setIsCautionDialogOpen }) => (
    <div>
      <span>Survey Menu Bar</span>
      <button onClick={() => setIsCautionDialogOpen(true)}>Open Caution Dialog</button>
    </div>
  )),
}));
vi.mock("@/modules/survey/follow-ups/components/follow-ups-view", () => ({
  FollowUpsView: vi.fn(() => <div>Follow Ups View</div>),
}));
vi.mock("@/modules/ui/components/preview-survey", () => ({
  PreviewSurvey: vi.fn(() => <div>Preview Survey</div>),
}));
vi.mock("../actions", () => ({
  refetchProjectAction: vi.fn(),
}));

const mockSurvey = {
  id: "survey1",
  name: "Test Survey",
  type: "app",
  status: "draft",
  questions: [
    {
      id: "q1",
      type: TSurveyQuestionTypeEnum.OpenText,
      headline: { default: "Q1" },
      required: false,
    } as unknown as TSurveyOpenTextQuestion,
  ],
  endings: [],
  languages: [
    { language: { id: "lang1", code: "default" } as TLanguage, default: true, enabled: true },
    { language: { id: "lang2", code: "en" } as TLanguage, default: false, enabled: true },
  ],
  triggers: [],
  recontactDays: null,
  displayOption: "displayOnce",
  autoClose: null,
  delay: 0,
  autoComplete: null,
  styling: null,
  surveyClosedMessage: null,
  singleUse: null,
  displayPercentage: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  environmentId: "env1",
  variables: [],
  welcomeCard: { enabled: false } as unknown as TSurvey["welcomeCard"],
  closeOnDate: null,
  segment: null,
  createdBy: null,
} as unknown as TSurvey;

const mockProject = {
  id: "project1",
  name: "Test Project",
  createdAt: new Date(),
  updatedAt: new Date(),
  organizationId: "org1",
  styling: { allowStyleOverwrite: true },
  recontactDays: 0,
  inAppSurveyBranding: false,
  linkSurveyBranding: false,
  placement: "bottomRight",
  clickOutsideClose: false,
  darkOverlay: false,
} as unknown as Project;

const mockEnvironment: Pick<Environment, "id" | "appSetupCompleted"> = {
  id: "env1",
  appSetupCompleted: true,
};

const mockLanguages: Language[] = [
  { id: "lang1", code: "default" } as Language,
  { id: "lang2", code: "en" } as Language,
];

describe("SurveyEditor", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  beforeEach(() => {
    // Reset mocks if needed, e.g., refetchProjectAction
    vi.mocked(refetchProjectAction).mockResolvedValue({ data: mockProject });
  });

  test("renders loading skeleton initially if survey is not provided", () => {
    render(
      <SurveyEditor
        // @ts-expect-error - Intentionally passing null for testing loading state
        survey={null}
        project={mockProject}
        projectLanguages={mockLanguages}
        environment={mockEnvironment}
        actionClasses={[]}
        contactAttributeKeys={[]}
        segments={[]}
        responseCount={0}
        membershipRole={OrganizationRole.owner}
        colors={[]}
        isMultiLanguageAllowed={true}
        isUserTargetingAllowed={true}
        isSpamProtectionAllowed={true}
        isFormbricksCloud={false}
        isUnsplashConfigured={false}
        plan="free"
        isCxMode={false}
        locale={"en" as TUserLocale}
        projectPermission={null as TTeamPermission | null}
        mailFrom="test@example.com"
        isSurveyFollowUpsAllowed={true}
        userEmail="user@example.com"
        teamMemberDetails={[]}
      />
    );
    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  test("renders default view (Questions) correctly", () => {
    render(
      <SurveyEditor
        survey={mockSurvey}
        project={mockProject}
        projectLanguages={mockLanguages}
        environment={mockEnvironment}
        actionClasses={[]}
        contactAttributeKeys={[]}
        segments={[]}
        responseCount={0}
        membershipRole={OrganizationRole.owner}
        colors={[]}
        isMultiLanguageAllowed={true}
        isUserTargetingAllowed={true}
        isSpamProtectionAllowed={true}
        isFormbricksCloud={false}
        isUnsplashConfigured={false}
        plan="free"
        isCxMode={false}
        locale={"en" as TUserLocale}
        projectPermission={null as TTeamPermission | null}
        mailFrom="test@example.com"
        isSurveyFollowUpsAllowed={true}
        userEmail="user@example.com"
        teamMemberDetails={[]}
      />
    );
    expect(screen.getByText("Survey Menu Bar")).toBeInTheDocument();
    expect(screen.getByText("Questions View")).toBeInTheDocument();
    expect(screen.getByText("Preview Survey")).toBeInTheDocument();
    expect(screen.getByText("Active Tab: questions")).toBeInTheDocument();
  });

  test("switches to Styling view when Styling tab is clicked", async () => {
    const user = userEvent.setup();
    render(
      <SurveyEditor
        survey={mockSurvey}
        project={mockProject}
        projectLanguages={mockLanguages}
        environment={mockEnvironment}
        actionClasses={[]}
        contactAttributeKeys={[]}
        segments={[]}
        responseCount={0}
        membershipRole={OrganizationRole.owner}
        colors={[]}
        isMultiLanguageAllowed={true}
        isUserTargetingAllowed={true}
        isSpamProtectionAllowed={true}
        isFormbricksCloud={false}
        isUnsplashConfigured={false}
        plan="free"
        isCxMode={false}
        locale={"en" as TUserLocale}
        projectPermission={null as TTeamPermission | null}
        mailFrom="test@example.com"
        isSurveyFollowUpsAllowed={true}
        userEmail="user@example.com"
        teamMemberDetails={[]}
      />
    );
    const stylingTabButton = screen.getByText("Styling Tab");
    await user.click(stylingTabButton);
    expect(screen.getByText("Styling View")).toBeInTheDocument();
    expect(screen.queryByText("Questions View")).not.toBeInTheDocument();
    expect(screen.getByText("Active Tab: styling")).toBeInTheDocument();
  });

  test("switches to Settings view when Settings tab is clicked", async () => {
    const user = userEvent.setup();
    render(
      <SurveyEditor
        survey={mockSurvey}
        project={mockProject}
        projectLanguages={mockLanguages}
        environment={mockEnvironment}
        actionClasses={[]}
        contactAttributeKeys={[]}
        segments={[]}
        responseCount={0}
        membershipRole={OrganizationRole.owner}
        colors={[]}
        isMultiLanguageAllowed={true}
        isUserTargetingAllowed={true}
        isSpamProtectionAllowed={true}
        isFormbricksCloud={false}
        isUnsplashConfigured={false}
        plan="free"
        isCxMode={false}
        locale={"en" as TUserLocale}
        projectPermission={null as TTeamPermission | null}
        mailFrom="test@example.com"
        isSurveyFollowUpsAllowed={true}
        userEmail="user@example.com"
        teamMemberDetails={[]}
      />
    );
    const settingsTabButton = screen.getByText("Settings Tab");
    await user.click(settingsTabButton);
    expect(screen.getByText("Settings View")).toBeInTheDocument();
    expect(screen.queryByText("Questions View")).not.toBeInTheDocument();
    expect(screen.getByText("Active Tab: settings")).toBeInTheDocument();
  });

  test("switches to Follow-ups view when Follow-ups tab is clicked", async () => {
    const user = userEvent.setup();
    render(
      <SurveyEditor
        survey={mockSurvey}
        project={mockProject}
        projectLanguages={mockLanguages}
        environment={mockEnvironment}
        actionClasses={[]}
        contactAttributeKeys={[]}
        segments={[]}
        responseCount={0}
        membershipRole={OrganizationRole.owner}
        colors={[]}
        isMultiLanguageAllowed={true}
        isUserTargetingAllowed={true}
        isSpamProtectionAllowed={true}
        isFormbricksCloud={false}
        isUnsplashConfigured={false}
        plan="free"
        isCxMode={false}
        locale={"en" as TUserLocale}
        projectPermission={null as TTeamPermission | null}
        mailFrom="test@example.com"
        isSurveyFollowUpsAllowed={true}
        userEmail="user@example.com"
        teamMemberDetails={[]}
      />
    );
    const followUpsTabButton = screen.getByText("Follow-ups Tab");
    await user.click(followUpsTabButton);
    expect(screen.getByText("Follow Ups View")).toBeInTheDocument();
    expect(screen.queryByText("Questions View")).not.toBeInTheDocument();
    expect(screen.getByText("Active Tab: followUps")).toBeInTheDocument();
  });

  test("opens caution dialog when triggered from menu bar", async () => {
    const user = userEvent.setup();
    render(
      <SurveyEditor
        survey={mockSurvey}
        project={mockProject}
        projectLanguages={mockLanguages}
        environment={mockEnvironment}
        actionClasses={[]}
        contactAttributeKeys={[]}
        segments={[]}
        responseCount={0}
        membershipRole={OrganizationRole.owner}
        colors={[]}
        isMultiLanguageAllowed={true}
        isUserTargetingAllowed={true}
        isSpamProtectionAllowed={true}
        isFormbricksCloud={false}
        isUnsplashConfigured={false}
        plan="free"
        isCxMode={false}
        locale={"en" as TUserLocale}
        projectPermission={null as TTeamPermission | null}
        mailFrom="test@example.com"
        isSurveyFollowUpsAllowed={true}
        userEmail="user@example.com"
        teamMemberDetails={[]}
      />
    );
    expect(screen.queryByText("Edit Alert Dialog")).not.toBeInTheDocument();
    const openDialogButton = screen.getByText("Open Caution Dialog");
    await user.click(openDialogButton);
    expect(screen.getByText("Edit Alert Dialog")).toBeInTheDocument();
  });

  test("does not render Styling tab if allowStyleOverwrite is false", () => {
    const projectWithoutStyling = { ...mockProject, styling: { allowStyleOverwrite: false } };
    render(
      <SurveyEditor
        survey={mockSurvey}
        project={projectWithoutStyling}
        projectLanguages={mockLanguages}
        environment={mockEnvironment}
        actionClasses={[]}
        contactAttributeKeys={[]}
        segments={[]}
        responseCount={0}
        membershipRole={OrganizationRole.owner}
        colors={[]}
        isMultiLanguageAllowed={true}
        isUserTargetingAllowed={true}
        isSpamProtectionAllowed={true}
        isFormbricksCloud={false}
        isUnsplashConfigured={false}
        plan="free"
        isCxMode={false}
        locale={"en" as TUserLocale}
        projectPermission={null as TTeamPermission | null}
        mailFrom="test@example.com"
        isSurveyFollowUpsAllowed={true}
        userEmail="user@example.com"
        teamMemberDetails={[]}
      />
    );
    expect(screen.queryByText("Styling Tab")).not.toBeInTheDocument();
  });

  test("does not render Follow-ups tab if isSurveyFollowUpsAllowed is false", () => {
    render(
      <SurveyEditor
        survey={mockSurvey}
        project={mockProject}
        projectLanguages={mockLanguages}
        environment={mockEnvironment}
        actionClasses={[]}
        contactAttributeKeys={[]}
        segments={[]}
        responseCount={0}
        membershipRole={OrganizationRole.owner}
        colors={[]}
        isMultiLanguageAllowed={true}
        isUserTargetingAllowed={true}
        isSpamProtectionAllowed={true}
        isFormbricksCloud={false}
        isUnsplashConfigured={false}
        plan="free"
        isCxMode={false}
        locale={"en" as TUserLocale}
        projectPermission={null as TTeamPermission | null}
        mailFrom="test@example.com"
        isSurveyFollowUpsAllowed={false} // Set to false
        userEmail="user@example.com"
        teamMemberDetails={[]}
      />
    );
    expect(screen.queryByText("Follow-ups Tab")).not.toBeInTheDocument();
  });
});
