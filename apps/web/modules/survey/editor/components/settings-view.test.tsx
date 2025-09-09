import { TTeamPermission } from "@/modules/ee/teams/project-teams/types/team";
import { ActionClass, Environment, OrganizationRole } from "@prisma/client";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { TContactAttributeKey } from "@formbricks/types/contact-attribute-key";
import { TSegment } from "@formbricks/types/segment";
import { TSurvey, TSurveyQuestionTypeEnum } from "@formbricks/types/surveys/types";
import { SettingsView } from "./settings-view";

// Mock child components
vi.mock("@/modules/ee/contacts/segments/components/targeting-card", () => ({
  TargetingCard: ({ localSurvey, environmentId }: any) => (
    <div data-testid="targeting-card">
      TargetingCard - Survey: {localSurvey.id}, Env: {environmentId}
    </div>
  ),
}));

vi.mock("@/modules/survey/editor/components/how-to-send-card", () => ({
  HowToSendCard: ({ localSurvey, environment }: any) => (
    <div data-testid="how-to-send-card">
      HowToSendCard - Survey: {localSurvey.id}, Env: {environment.id}
    </div>
  ),
}));

vi.mock("@/lib/constants", () => ({
  IS_FORMBRICKS_CLOUD: false,
  ENCRYPTION_KEY: "mock-encryption-key",
  ENTERPRISE_LICENSE_KEY: "mock-enterprise-license-key",
  GITHUB_ID: "mock-github-id",
  GITHUB_SECRET: "test-githubID",
  GOOGLE_CLIENT_ID: "test-google-client-id",
  GOOGLE_CLIENT_SECRET: "test-google-client-secret",
  AZUREAD_CLIENT_ID: "test-azuread-client-id",
  AZUREAD_CLIENT_SECRET: "test-azure",
  AZUREAD_TENANT_ID: "test-azuread-tenant-id",
  OIDC_DISPLAY_NAME: "test-oidc-display-name",
  OIDC_CLIENT_ID: "test-oidc-client-id",
  OIDC_ISSUER: "test-oidc-issuer",
  OIDC_CLIENT_SECRET: "test-oidc-client-secret",
  OIDC_SIGNING_ALGORITHM: "test-oidc-signing-algorithm",
  WEBAPP_URL: "test-webapp-url",
  IS_PRODUCTION: false,
  SENTRY_DSN: "mock-sentry-dsn",
  SENTRY_RELEASE: "mock-sentry-release",
  SENTRY_ENVIRONMENT: "mock-sentry-environment",
  SESSION_MAX_AGE: 1000,
}));

vi.mock("@/modules/survey/editor/components/recontact-options-card", () => ({
  RecontactOptionsCard: ({ localSurvey, environmentId }: any) => (
    <div data-testid="recontact-options-card">
      RecontactOptionsCard - Survey: {localSurvey.id}, Env: {environmentId}
    </div>
  ),
}));

vi.mock("@/modules/survey/editor/components/response-options-card", () => ({
  ResponseOptionsCard: ({ localSurvey, responseCount, isSpamProtectionAllowed }: any) => (
    <div data-testid="response-options-card">
      ResponseOptionsCard - Survey: {localSurvey.id}, Count: {responseCount}, Spam:{" "}
      {isSpamProtectionAllowed.toString()}
    </div>
  ),
}));

vi.mock("@/modules/survey/editor/components/survey-placement-card", () => ({
  SurveyPlacementCard: ({ localSurvey, environmentId }: any) => (
    <div data-testid="survey-placement-card">
      SurveyPlacementCard - Survey: {localSurvey.id}, Env: {environmentId}
    </div>
  ),
}));

vi.mock("@/modules/survey/editor/components/targeting-locked-card", () => ({
  TargetingLockedCard: ({ isFormbricksCloud, environmentId }: any) => (
    <div data-testid="targeting-locked-card">
      TargetingLockedCard - Cloud: {isFormbricksCloud.toString()}, Env: {environmentId}
    </div>
  ),
}));

vi.mock("@/modules/survey/editor/components/when-to-send-card", () => ({
  WhenToSendCard: ({ localSurvey, environmentId }: any) => (
    <div data-testid="when-to-send-card">
      WhenToSendCard - Survey: {localSurvey.id}, Env: {environmentId}
    </div>
  ),
}));

// Mock @formkit/auto-animate package that's causing the window.matchMedia issue
vi.mock("@formkit/auto-animate/react", () => ({
  useAutoAnimate: () => [null, () => {}],
}));

const mockEnvironment: Pick<Environment, "id" | "appSetupCompleted"> = {
  id: "env-123",
  appSetupCompleted: true,
};

const mockActionClasses: ActionClass[] = [];
const mockContactAttributeKeys: TContactAttributeKey[] = [];
const mockSegments: TSegment[] = [];
const mockProjectPermission: TTeamPermission | null = null;

const baseSurvey = {
  id: "survey-123",
  name: "Test Survey",
  type: "app", // Default to app survey
  environmentId: "env-123",
  status: "draft",
  questions: [
    {
      id: "question-123",
      type: TSurveyQuestionTypeEnum.OpenText,
      headline: { default: "Question 1" },
      required: true,
    },
  ],
  welcomeCard: { enabled: false } as unknown as TSurvey["welcomeCard"],
  languages: [],
  triggers: [],
  recontactDays: null,
  displayOption: "displayOnce",
  autoClose: null,
  delay: 0,
  autoComplete: null,
  styling: null,
  surveyClosedMessage: null,
  singleUse: null,
  pin: null,
  segment: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  createdBy: null,
  variables: [],
  closeOnDate: null,
  endings: [],
  hiddenFields: { enabled: false, fieldIds: [] },
} as unknown as TSurvey;

describe("SettingsView", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders all cards for app survey when targeting is allowed", () => {
    const mockSurvey: TSurvey = { ...baseSurvey, type: "app" };
    render(
      <SettingsView
        environment={mockEnvironment}
        localSurvey={mockSurvey}
        setLocalSurvey={vi.fn()}
        actionClasses={mockActionClasses}
        contactAttributeKeys={mockContactAttributeKeys}
        segments={mockSegments}
        responseCount={10}
        membershipRole={OrganizationRole.owner}
        isUserTargetingAllowed={true}
        isSpamProtectionAllowed={true}
        projectPermission={mockProjectPermission}
        isFormbricksCloud={true}
        isQuotasAllowed={true}
        quotas={[]}
      />
    );

    expect(screen.getByTestId("how-to-send-card")).toBeInTheDocument();
    expect(screen.getByTestId("targeting-card")).toBeInTheDocument();
    expect(screen.queryByTestId("targeting-locked-card")).not.toBeInTheDocument();
    expect(screen.getByTestId("when-to-send-card")).toBeInTheDocument();
    expect(screen.getByTestId("response-options-card")).toBeInTheDocument();
    expect(screen.getByTestId("recontact-options-card")).toBeInTheDocument();
    expect(screen.getByTestId("survey-placement-card")).toBeInTheDocument();

    // Check props passed
    expect(screen.getByTestId("how-to-send-card")).toHaveTextContent("Survey: survey-123");
    expect(screen.getByTestId("targeting-card")).toHaveTextContent("Survey: survey-123");
    expect(screen.getByTestId("when-to-send-card")).toHaveTextContent("Survey: survey-123");
    expect(screen.getByTestId("response-options-card")).toHaveTextContent("Survey: survey-123");
    expect(screen.getByTestId("response-options-card")).toHaveTextContent("Count: 10");
    expect(screen.getByTestId("response-options-card")).toHaveTextContent("Spam: true");
    expect(screen.getByTestId("recontact-options-card")).toHaveTextContent("Survey: survey-123");
    expect(screen.getByTestId("survey-placement-card")).toHaveTextContent("Survey: survey-123");
  });

  test("renders TargetingLockedCard when targeting is not allowed for app survey", () => {
    const mockSurvey: TSurvey = { ...baseSurvey, type: "app" };
    render(
      <SettingsView
        environment={mockEnvironment}
        localSurvey={mockSurvey}
        setLocalSurvey={vi.fn()}
        actionClasses={mockActionClasses}
        contactAttributeKeys={mockContactAttributeKeys}
        segments={mockSegments}
        responseCount={5}
        membershipRole={OrganizationRole.owner}
        isUserTargetingAllowed={false}
        isSpamProtectionAllowed={false}
        projectPermission={mockProjectPermission}
        isFormbricksCloud={false}
        isQuotasAllowed={true}
        quotas={[]}
      />
    );

    expect(screen.getByTestId("how-to-send-card")).toBeInTheDocument();
    expect(screen.queryByTestId("targeting-card")).not.toBeInTheDocument();
    expect(screen.getByTestId("targeting-locked-card")).toBeInTheDocument();
    expect(screen.getByTestId("when-to-send-card")).toBeInTheDocument();
    expect(screen.getByTestId("response-options-card")).toBeInTheDocument();
    expect(screen.getByTestId("recontact-options-card")).toBeInTheDocument();
    expect(screen.getByTestId("survey-placement-card")).toBeInTheDocument();

    // Check props passed
    expect(screen.getByTestId("targeting-locked-card")).toHaveTextContent("Cloud: false");
    expect(screen.getByTestId("targeting-locked-card")).toHaveTextContent("Env: env-123");
    expect(screen.getByTestId("response-options-card")).toHaveTextContent("Count: 5");
    expect(screen.getByTestId("response-options-card")).toHaveTextContent("Spam: false");
  });

  test("renders correct cards for link survey", () => {
    const mockSurvey: TSurvey = { ...baseSurvey, type: "link" };
    render(
      <SettingsView
        environment={mockEnvironment}
        localSurvey={mockSurvey}
        setLocalSurvey={vi.fn()}
        actionClasses={mockActionClasses}
        contactAttributeKeys={mockContactAttributeKeys}
        segments={mockSegments}
        responseCount={0}
        membershipRole={OrganizationRole.owner}
        isUserTargetingAllowed={true} // This should be ignored for link surveys
        isSpamProtectionAllowed={true}
        projectPermission={mockProjectPermission}
        isFormbricksCloud={true}
        isQuotasAllowed={true}
        quotas={[]}
      />
    );

    expect(screen.getByTestId("how-to-send-card")).toBeInTheDocument();
    expect(screen.queryByTestId("targeting-card")).not.toBeInTheDocument();
    expect(screen.queryByTestId("targeting-locked-card")).not.toBeInTheDocument();
    expect(screen.getByTestId("when-to-send-card")).toBeInTheDocument(); // WhenToSendCard is still relevant for link surveys (e.g., close on date)
    expect(screen.getByTestId("response-options-card")).toBeInTheDocument();
    expect(screen.getByTestId("recontact-options-card")).toBeInTheDocument();
    expect(screen.queryByTestId("survey-placement-card")).not.toBeInTheDocument();

    // Check props passed
    expect(screen.getByTestId("response-options-card")).toHaveTextContent("Count: 0");
    expect(screen.getByTestId("response-options-card")).toHaveTextContent("Spam: true");
  });
});
