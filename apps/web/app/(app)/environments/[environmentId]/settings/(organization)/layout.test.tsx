import { getOrganizationByEnvironmentId } from "@/lib/organization/service";
import { getProjectByEnvironmentId } from "@/lib/project/service";
import { cleanup, render, screen } from "@testing-library/react";
import { Session, getServerSession } from "next-auth";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { TOrganization } from "@formbricks/types/organizations";
import { TProject } from "@formbricks/types/project";
import OrganizationSettingsLayout from "./layout";

// Mock dependencies
vi.mock("@/lib/organization/service");
vi.mock("@/lib/project/service");
vi.mock("next-auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next-auth")>();
  return {
    ...actual,
    getServerSession: vi.fn(),
  };
});
vi.mock("@/modules/auth/lib/authOptions", () => ({
  authOptions: {}, // Mock authOptions if it's directly used or causes issues
}));

vi.mock("@/lib/constants", () => ({
  IS_FORMBRICKS_CLOUD: false,
  POSTHOG_API_KEY: "mock-posthog-api-key",
  POSTHOG_HOST: "mock-posthog-host",
  IS_POSTHOG_CONFIGURED: true,
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
}));

const mockGetOrganizationByEnvironmentId = vi.mocked(getOrganizationByEnvironmentId);
const mockGetProjectByEnvironmentId = vi.mocked(getProjectByEnvironmentId);
const mockGetServerSession = vi.mocked(getServerSession);

const mockOrganization = { id: "org_test_id" } as unknown as TOrganization;
const mockProject = { id: "project_test_id" } as unknown as TProject;
const mockSession = { user: { id: "user_test_id" } } as unknown as Session;

const t = (key: string) => key;
vi.mock("@/tolgee/server", () => ({
  getTranslate: async () => t,
}));

const mockProps = {
  params: { environmentId: "env_test_id" },
  children: <div>Child Content for Organization Settings</div>,
};

describe("OrganizationSettingsLayout", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.resetAllMocks();

    mockGetOrganizationByEnvironmentId.mockResolvedValue(mockOrganization);
    mockGetProjectByEnvironmentId.mockResolvedValue(mockProject);
    mockGetServerSession.mockResolvedValue(mockSession);
  });

  test("should render children when all data is fetched successfully", async () => {
    render(await OrganizationSettingsLayout(mockProps));
    expect(screen.getByText("Child Content for Organization Settings")).toBeInTheDocument();
  });

  test("should throw error if organization is not found", async () => {
    mockGetOrganizationByEnvironmentId.mockResolvedValue(null);
    await expect(OrganizationSettingsLayout(mockProps)).rejects.toThrowError("common.organization_not_found");
  });

  test("should throw error if project is not found", async () => {
    mockGetProjectByEnvironmentId.mockResolvedValue(null);
    await expect(OrganizationSettingsLayout(mockProps)).rejects.toThrowError("common.project_not_found");
  });

  test("should throw error if session is not found", async () => {
    mockGetServerSession.mockResolvedValue(null);
    await expect(OrganizationSettingsLayout(mockProps)).rejects.toThrowError("common.session_not_found");
  });
});
