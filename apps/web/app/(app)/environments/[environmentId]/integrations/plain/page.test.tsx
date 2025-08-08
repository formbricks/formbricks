import { getSurveys } from "@/app/(app)/environments/[environmentId]/integrations/lib/surveys";
import { getIntegrationByType } from "@/lib/integration/service";
import { findMatchingLocale } from "@/lib/utils/locale";
import { getEnvironmentAuth } from "@/modules/environments/lib/utils";
import { cleanup, render, screen } from "@testing-library/react";
import { redirect } from "next/navigation";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { TEnvironment } from "@formbricks/types/environment";
import { TIntegrationPlain } from "@formbricks/types/integration/plain";
import { TSurvey } from "@formbricks/types/surveys/types";
import Page from "./page";

// Mock dependencies
vi.mock("@/app/(app)/environments/[environmentId]/integrations/plain/components/PlainWrapper", () => ({
  PlainWrapper: vi.fn(
    ({ enabled, surveys, environment, plainIntegration, webAppUrl, databasesArray, locale }) => (
      <div>
        <span>Mocked PlainWrapper</span>
        <span data-testid="enabled">{enabled.toString()}</span>
        <span data-testid="environmentId">{environment.id}</span>
        <span data-testid="surveyCount">{surveys?.length ?? 0}</span>
        <span data-testid="integrationId">{plainIntegration?.id}</span>
        <span data-testid="webAppUrl">{webAppUrl}</span>
        <span data-testid="databasesArray">{databasesArray?.length ?? 0}</span>
        <span data-testid="locale">{locale}</span>
      </div>
    )
  ),
}));
vi.mock("@/app/(app)/environments/[environmentId]/integrations/lib/surveys", () => ({
  getSurveys: vi.fn(),
}));
vi.mock("@/lib/integration/service", () => ({
  getIntegrationByType: vi.fn(),
}));
vi.mock("@/lib/utils/locale", () => ({
  findMatchingLocale: vi.fn(),
}));
vi.mock("@/modules/environments/lib/utils", () => ({
  getEnvironmentAuth: vi.fn(),
}));
vi.mock("@/modules/ui/components/go-back-button", () => ({
  GoBackButton: vi.fn(({ url }) => <div data-testid="go-back">{url}</div>),
}));
vi.mock("@/modules/ui/components/page-content-wrapper", () => ({
  PageContentWrapper: vi.fn(({ children }) => <div>{children}</div>),
}));
vi.mock("@/modules/ui/components/page-header", () => ({
  PageHeader: vi.fn(({ pageTitle }) => <h1>{pageTitle}</h1>),
}));
vi.mock("@/tolgee/server", () => ({
  getTranslate: async () => (key) => key,
}));
vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));
vi.mock("@/lib/constants", () => ({
  WEBAPP_URL: "https://app.formbricks.com",
}));

const mockEnvironment = {
  id: "test-env-id",
  createdAt: new Date(),
  updatedAt: new Date(),
  appSetupCompleted: true,
  type: "development",
  projectId: "project-id",
  project: {
    id: "project-id",
    name: "Test Project",
    environments: [],
    people: [],
    surveys: [],
    tags: [],
    webhooks: [],
    apiKey: {
      id: "api-key",
      createdAt: new Date(),
      updatedAt: new Date(),
      hashedKey: "hashed",
      label: "api",
    },
    logo: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    organizationId: "org-id",
    recontactDays: 30,
    inAppSurveyBranding: false,
    linkSurveyBranding: false,
    placement: "bottomRight",
    clickOutsideClose: true,
    darkOverlay: false,
  },
} as unknown as TEnvironment;

const mockSurveys: TSurvey[] = [
  {
    id: "survey1",
    name: "Survey 1",
    createdAt: new Date(),
    updatedAt: new Date(),
    environmentId: "test-env-id",
    status: "inProgress",
    type: "app",
    questions: [],
    triggers: [],
    recontactDays: null,
    autoClose: null,
    closeOnDate: null,
    delay: 0,
    displayOption: "displayOnce",
    displayPercentage: null,
    languages: [],
    pin: null,
    resultShareKey: null,
    segment: null,
    singleUse: null,
    styling: null,
    surveyClosedMessage: null,
    welcomeCard: { enabled: false } as unknown as TSurvey["welcomeCard"],
    autoComplete: null,
    runOnDate: null,
  } as unknown as TSurvey,
];

const mockPlainIntegration = {
  id: "integration1",
  type: "plain",
  environmentId: "test-env-id",
  config: {
    key: "plain-key",
    data: [],
  },
} as unknown as TIntegrationPlain;

const mockProps = {
  params: { environmentId: "test-env-id" },
};

describe("PlainIntegrationPage", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  beforeEach(() => {
    vi.mocked(getEnvironmentAuth).mockResolvedValue({
      environment: mockEnvironment,
      project: {} as any,
      organization: {} as any,
      session: {} as any,
      currentUserMembership: {} as any,
      projectPermission: {} as any,
      isMember: true,
      isOwner: false,
      isManager: false,
      isBilling: false,
      hasReadAccess: true,
      hasReadWriteAccess: true,
      hasManageAccess: false,
      isReadOnly: false,
    });
    vi.mocked(getSurveys).mockResolvedValue(mockSurveys);
    vi.mocked(getIntegrationByType).mockResolvedValue(mockPlainIntegration);
    vi.mocked(findMatchingLocale).mockResolvedValue("en-US");
  });

  test("renders the page with PlainWrapper when enabled and not read-only", async () => {
    const PageComponent = await Page(mockProps);
    render(PageComponent);

    expect(screen.getByText("environments.integrations.plain.plain_integration")).toBeInTheDocument();
    expect(screen.getByText("Mocked PlainWrapper")).toBeInTheDocument();
    expect(screen.getByTestId("enabled")).toHaveTextContent("true");
    expect(screen.getByTestId("environmentId")).toHaveTextContent(mockEnvironment.id);
    expect(screen.getByTestId("surveyCount")).toHaveTextContent(mockSurveys.length.toString());
    expect(screen.getByTestId("integrationId")).toHaveTextContent(mockPlainIntegration.id);
    expect(screen.getByTestId("webAppUrl")).toHaveTextContent("https://app.formbricks.com");
    expect(screen.getByTestId("databasesArray")).toHaveTextContent("0");
    expect(screen.getByTestId("locale")).toHaveTextContent("en-US");
    expect(screen.getByTestId("go-back")).toHaveTextContent(
      `https://app.formbricks.com/environments/${mockProps.params.environmentId}/integrations`
    );
    expect(vi.mocked(redirect)).not.toHaveBeenCalled();
  });

  test("calls redirect when user is read-only", async () => {
    vi.mocked(getEnvironmentAuth).mockResolvedValue({
      environment: mockEnvironment,
      project: {} as any,
      organization: {} as any,
      session: {} as any,
      currentUserMembership: {} as any,
      projectPermission: {} as any,
      isMember: true,
      isOwner: false,
      isManager: false,
      isBilling: false,
      hasReadAccess: true,
      hasReadWriteAccess: false,
      hasManageAccess: false,
      isReadOnly: true,
    });

    const PageComponent = await Page(mockProps);
    render(PageComponent);

    expect(vi.mocked(redirect)).toHaveBeenCalledWith("./");
  });
});
