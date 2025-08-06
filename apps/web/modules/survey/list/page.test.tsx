import { TEnvironmentAuth } from "@/modules/environments/types/environment-auth";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { Session } from "next-auth";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { TEnvironment } from "@formbricks/types/environment";
import { TProject } from "@formbricks/types/project";
import { TTemplateRole } from "@formbricks/types/templates";
import { SurveysPage } from "./page";

// Mock all dependencies
vi.mock("@/lib/constants", () => ({
  DEFAULT_LOCALE: "en-US",
  SURVEYS_PER_PAGE: 12,
}));

vi.mock("@/lib/getPublicUrl", () => ({
  getPublicDomain: vi.fn(),
}));

vi.mock("@/lib/user/service", () => ({
  getUserLocale: vi.fn(),
}));

vi.mock("@/modules/environments/lib/utils", () => ({
  getEnvironmentAuth: vi.fn(),
}));

vi.mock("@/modules/survey/lib/project", () => ({
  getProjectWithTeamIdsByEnvironmentId: vi.fn(),
}));

vi.mock("@/modules/survey/list/components/survey-list", () => ({
  SurveysList: vi.fn(
    ({ environmentId, isReadOnly, publicDomain, userId, surveysPerPage, currentProjectChannel, locale }) => (
      <div
        data-testid="surveys-list"
        data-environment-id={environmentId}
        data-readonly={isReadOnly}
        data-public-domain={publicDomain}
        data-user-id={userId}
        data-surveys-per-page={surveysPerPage}
        data-channel={currentProjectChannel}
        data-locale={locale}>
        Surveys List
      </div>
    )
  ),
}));

vi.mock("@/modules/survey/list/lib/survey", () => ({
  getSurveyCount: vi.fn(),
}));

vi.mock("@/modules/survey/templates/components/template-container", () => ({
  TemplateContainerWithPreview: vi.fn(
    ({ userId, environment, project, prefilledFilters, isTemplatePage }) => (
      <div
        data-testid="template-container"
        data-user-id={userId}
        data-environment-id={environment.id}
        data-project-id={project.id}
        data-prefilled-filters={JSON.stringify(prefilledFilters)}
        data-is-template-page={isTemplatePage}>
        Template Container
      </div>
    )
  ),
}));

vi.mock("@/modules/ui/components/button", () => ({
  Button: vi.fn(({ size, asChild, children }) => (
    <button data-testid="create-survey-button" type="button" data-size={size} data-as-child={asChild}>
      {children}
    </button>
  )),
}));

vi.mock("@/modules/ui/components/page-content-wrapper", () => ({
  PageContentWrapper: vi.fn(({ children }) => <div data-testid="page-content-wrapper">{children}</div>),
}));

vi.mock("@/modules/ui/components/page-header", () => ({
  PageHeader: vi.fn(({ pageTitle, cta }) => (
    <div data-testid="page-header">
      <span data-testid="page-title">{pageTitle}</span>
      {cta}
    </div>
  )),
}));

vi.mock("@/tolgee/server", () => ({
  getTranslate: vi.fn(),
}));

vi.mock("next/link", () => ({
  default: vi.fn(({ href, children }) => (
    <a href={href} data-testid="link">
      {children}
    </a>
  )),
}));

describe("SurveysPage", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  const mockSession: Session = {
    user: {
      id: "user-123",
    },
    expires: "2024-12-31T23:59:59.999Z",
  };

  const mockEnvironment: TEnvironment = {
    id: "env-123",
    createdAt: new Date(),
    updatedAt: new Date(),
    type: "development",
    projectId: "project-123",
    appSetupCompleted: true,
  };

  const mockProject: TProject = {
    id: "project-123",
    name: "Test Project",
    createdAt: new Date(),
    updatedAt: new Date(),
    organizationId: "org-123",
    config: {
      channel: "website",
      industry: "other",
    },
    styling: {
      brandColor: {
        light: "#000000",
      },
    },
  } as TProject;

  const mockEnvironmentAuth: TEnvironmentAuth = {
    session: mockSession,
    environment: mockEnvironment,
    project: mockProject,
    organization: {
      id: "org-123",
      name: "Test Organization",
      createdAt: new Date(),
      updatedAt: new Date(),
      billing: null,
    } as any,
    currentUserMembership: {
      userId: "user-123",
      organizationId: "org-123",
      accepted: true,
      role: "admin",
    } as any,
    projectPermission: null,
    isMember: true,
    isOwner: true,
    isManager: false,
    isBilling: false,
    hasReadAccess: true,
    hasReadWriteAccess: true,
    hasManageAccess: true,
    isReadOnly: false,
  };

  const mockTranslate = vi.fn((key: string) => key);
  const mockGetPublicDomain = vi.fn();
  const mockGetUserLocale = vi.fn();
  const mockGetEnvironmentAuth = vi.fn();
  const mockGetProjectWithTeamIdsByEnvironmentId = vi.fn();
  const mockGetSurveyCount = vi.fn();
  const mockGetTranslate = vi.fn();

  beforeEach(async () => {
    mockGetPublicDomain.mockReturnValue("https://app.formbricks.com");
    mockGetUserLocale.mockResolvedValue("en-US");
    mockGetEnvironmentAuth.mockResolvedValue(mockEnvironmentAuth);
    mockGetProjectWithTeamIdsByEnvironmentId.mockResolvedValue(mockProject);
    mockGetSurveyCount.mockResolvedValue(5);
    mockGetTranslate.mockResolvedValue(mockTranslate);

    // Set up mocks
    const { getPublicDomain } = await import("@/lib/getPublicUrl");
    const { getUserLocale } = await import("@/lib/user/service");
    const { getEnvironmentAuth } = await import("@/modules/environments/lib/utils");
    const { getProjectWithTeamIdsByEnvironmentId } = await import("@/modules/survey/lib/project");
    const { getSurveyCount } = await import("@/modules/survey/list/lib/survey");
    const { getTranslate } = await import("@/tolgee/server");

    vi.mocked(getPublicDomain).mockImplementation(mockGetPublicDomain);
    vi.mocked(getUserLocale).mockImplementation(mockGetUserLocale);
    vi.mocked(getEnvironmentAuth).mockImplementation(mockGetEnvironmentAuth);
    vi.mocked(getProjectWithTeamIdsByEnvironmentId).mockImplementation(
      mockGetProjectWithTeamIdsByEnvironmentId
    );
    vi.mocked(getSurveyCount).mockImplementation(mockGetSurveyCount);
    vi.mocked(getTranslate).mockImplementation(mockGetTranslate);
  });

  test("throws error when project is not found", async () => {
    mockGetProjectWithTeamIdsByEnvironmentId.mockResolvedValue(null);
    mockTranslate.mockReturnValue("Project not found");

    const params = Promise.resolve({ environmentId: "env-123" });
    const searchParams = Promise.resolve({});

    await expect(SurveysPage({ params, searchParams })).rejects.toThrow("Project not found");

    expect(mockGetProjectWithTeamIdsByEnvironmentId).toHaveBeenCalledWith("env-123");
    expect(mockTranslate).toHaveBeenCalledWith("common.project_not_found");
  });

  test("redirects to billing when isBilling is true", async () => {
    const { redirect } = await import("next/navigation");
    const mockRedirect = vi.mocked(redirect);

    mockGetEnvironmentAuth.mockResolvedValue({
      ...mockEnvironmentAuth,
      isBilling: true,
    });

    const params = Promise.resolve({ environmentId: "env-123" });
    const searchParams = Promise.resolve({});

    await SurveysPage({ params, searchParams });

    expect(mockRedirect).toHaveBeenCalledWith("/environments/env-123/settings/billing");
  });

  test("renders TemplateContainerWithPreview when survey count is 0", async () => {
    mockGetSurveyCount.mockResolvedValue(0);

    const params = Promise.resolve({ environmentId: "env-123" });
    const searchParams = Promise.resolve({ role: "product_manager" as TTemplateRole });

    const result = await SurveysPage({ params, searchParams });
    render(result);

    expect(screen.getByTestId("template-container")).toBeInTheDocument();
    expect(screen.getByTestId("template-container")).toHaveAttribute("data-user-id", "user-123");
    expect(screen.getByTestId("template-container")).toHaveAttribute("data-environment-id", "env-123");
    expect(screen.getByTestId("template-container")).toHaveAttribute("data-project-id", "project-123");
    expect(screen.getByTestId("template-container")).toHaveAttribute("data-is-template-page", "false");

    const prefilledFilters = JSON.parse(
      screen.getByTestId("template-container").getAttribute("data-prefilled-filters") || "[]"
    );
    expect(prefilledFilters).toEqual(["website", "other", "product_manager"]);
  });

  test("renders surveys list when survey count is greater than 0", async () => {
    mockGetSurveyCount.mockResolvedValue(5);

    const params = Promise.resolve({ environmentId: "env-123" });
    const searchParams = Promise.resolve({});

    const result = await SurveysPage({ params, searchParams });
    render(result);

    expect(screen.getByTestId("page-content-wrapper")).toBeInTheDocument();
    expect(screen.getByTestId("page-header")).toBeInTheDocument();
    expect(screen.getByTestId("page-title")).toHaveTextContent("common.surveys");
    expect(screen.getByTestId("create-survey-button")).toBeInTheDocument();
    expect(screen.getByTestId("surveys-list")).toBeInTheDocument();

    // Check SurveysList props
    expect(screen.getByTestId("surveys-list")).toHaveAttribute("data-environment-id", "env-123");
    expect(screen.getByTestId("surveys-list")).toHaveAttribute("data-readonly", "false");
    expect(screen.getByTestId("surveys-list")).toHaveAttribute(
      "data-public-domain",
      "https://app.formbricks.com"
    );
    expect(screen.getByTestId("surveys-list")).toHaveAttribute("data-user-id", "user-123");
    expect(screen.getByTestId("surveys-list")).toHaveAttribute("data-surveys-per-page", "12");
    expect(screen.getByTestId("surveys-list")).toHaveAttribute("data-channel", "website");
    expect(screen.getByTestId("surveys-list")).toHaveAttribute("data-locale", "en-US");
  });

  test("does not render create survey button when user is read-only", async () => {
    mockGetEnvironmentAuth.mockResolvedValue({
      ...mockEnvironmentAuth,
      isReadOnly: true,
    });
    mockGetSurveyCount.mockResolvedValue(5);

    const params = Promise.resolve({ environmentId: "env-123" });
    const searchParams = Promise.resolve({});

    const result = await SurveysPage({ params, searchParams });
    render(result);

    expect(screen.getByTestId("page-header")).toBeInTheDocument();
    expect(screen.queryByTestId("create-survey-button")).not.toBeInTheDocument();
    expect(screen.getByTestId("surveys-list")).toHaveAttribute("data-readonly", "true");
  });

  test("renders TemplateContainer when user is read-only and no surveys exist", async () => {
    mockGetEnvironmentAuth.mockResolvedValue({
      ...mockEnvironmentAuth,
      isReadOnly: true,
    });
    mockGetSurveyCount.mockResolvedValue(0);

    const params = Promise.resolve({ environmentId: "env-123" });
    const searchParams = Promise.resolve({});

    const result = await SurveysPage({ params, searchParams });
    render(result);

    // When survey count is 0, it should render TemplateContainer regardless of read-only status
    expect(screen.getByTestId("template-container")).toBeInTheDocument();
    expect(screen.getByTestId("template-container")).toHaveAttribute("data-user-id", "user-123");
    expect(screen.getByTestId("template-container")).toHaveAttribute("data-environment-id", "env-123");
  });

  test("handles project with null channel and industry", async () => {
    const projectWithNullConfig = {
      ...mockProject,
      config: {
        channel: null,
        industry: null,
      },
    };
    mockGetProjectWithTeamIdsByEnvironmentId.mockResolvedValue(projectWithNullConfig);
    mockGetSurveyCount.mockResolvedValue(0);

    const params = Promise.resolve({ environmentId: "env-123" });
    const searchParams = Promise.resolve({});

    const result = await SurveysPage({ params, searchParams });
    render(result);

    expect(screen.getByTestId("template-container")).toBeInTheDocument();
    const prefilledFilters = JSON.parse(
      screen.getByTestId("template-container").getAttribute("data-prefilled-filters") || "[]"
    );
    expect(prefilledFilters).toEqual([null, null, null]);
  });

  test("handles project with null styling", async () => {
    const projectWithNullStyling = {
      ...mockProject,
      styling: null,
    };
    mockGetProjectWithTeamIdsByEnvironmentId.mockResolvedValue(projectWithNullStyling);
    mockGetSurveyCount.mockResolvedValue(0);

    const params = Promise.resolve({ environmentId: "env-123" });
    const searchParams = Promise.resolve({});

    const result = await SurveysPage({ params, searchParams });
    render(result);

    expect(screen.getByTestId("template-container")).toBeInTheDocument();
    // Should handle null styling gracefully
  });

  test("handles getUserLocale returning null", async () => {
    mockGetUserLocale.mockResolvedValue(null);
    mockGetSurveyCount.mockResolvedValue(5);

    const params = Promise.resolve({ environmentId: "env-123" });
    const searchParams = Promise.resolve({});

    const result = await SurveysPage({ params, searchParams });
    render(result);

    expect(screen.getByTestId("surveys-list")).toHaveAttribute("data-locale", "en-US");
  });

  test("creates survey button with correct link", async () => {
    mockGetSurveyCount.mockResolvedValue(5);

    const params = Promise.resolve({ environmentId: "env-123" });
    const searchParams = Promise.resolve({});

    const result = await SurveysPage({ params, searchParams });
    render(result);

    expect(screen.getByTestId("link")).toHaveAttribute("href", "/environments/env-123/surveys/templates");
    expect(screen.getByTestId("create-survey-button")).toBeInTheDocument();
  });
});
