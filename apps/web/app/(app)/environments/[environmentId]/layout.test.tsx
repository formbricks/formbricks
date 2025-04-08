import { environmentIdLayoutChecks } from "@/modules/environments/lib/utils";
import { cleanup, render, screen } from "@testing-library/react";
import { Session } from "next-auth";
import { redirect } from "next/navigation";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getMembershipByUserIdOrganizationId } from "@formbricks/lib/membership/service";
import { getProjectByEnvironmentId } from "@formbricks/lib/project/service";
import { TMembership } from "@formbricks/types/memberships";
import { TOrganization, TOrganizationBilling } from "@formbricks/types/organizations";
import { TProject } from "@formbricks/types/project";
import { TUser } from "@formbricks/types/user";
import EnvLayout from "./layout";

vi.mock("@formbricks/lib/constants", () => ({
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
  FORMBRICKS_API_HOST: "mock-formbricks-api-host",
  FORMBRICKS_ENVIRONMENT_ID: "mock-formbricks-environment-id",
  IS_FORMBRICKS_ENABLED: true,
}));

// Mock sub-components to render identifiable elements
vi.mock("@/app/(app)/environments/[environmentId]/components/ResponseFilterContext", () => ({
  ResponseFilterProvider: ({ children }: any) => <div data-testid="ResponseFilterProvider">{children}</div>,
}));
vi.mock("@/app/(app)/environments/[environmentId]/components/EnvironmentLayout", () => ({
  EnvironmentLayout: ({ children }: any) => <div data-testid="EnvironmentLayout">{children}</div>,
}));
vi.mock("@/modules/ui/components/toaster-client", () => ({
  ToasterClient: () => <div data-testid="ToasterClient" />,
}));
vi.mock("../../components/FormbricksClient", () => ({
  FormbricksClient: ({ userId, email }: any) => (
    <div data-testid="FormbricksClient">
      {userId}-{email}
    </div>
  ),
}));
vi.mock("./components/EnvironmentStorageHandler", () => ({
  default: ({ environmentId }: any) => <div data-testid="EnvironmentStorageHandler">{environmentId}</div>,
}));
vi.mock("./components/PosthogIdentify", () => ({
  PosthogIdentify: ({ organizationId }: any) => <div data-testid="PosthogIdentify">{organizationId}</div>,
}));

vi.mock("@/modules/environments/lib/utils", () => ({
  environmentIdLayoutChecks: vi.fn(),
}));

vi.mock("@formbricks/lib/project/service", () => ({
  getProjectByEnvironmentId: vi.fn(),
}));

vi.mock("@formbricks/lib/membership/service", () => ({
  getMembershipByUserIdOrganizationId: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

describe("EnvLayout", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders successfully when all dependencies return valid data", async () => {
    vi.mocked(environmentIdLayoutChecks).mockResolvedValueOnce({
      t: ((key: string) => key) as any, // mock translation function does not need to be implemented
      session: { user: { id: "user1" } } as Session,
      user: { id: "user1", email: "user1@example.com" } as TUser,
      organization: {
        id: "org1",
        name: "Org1",
        billing: { plan: "premium" } as unknown as TOrganizationBilling,
      } as TOrganization,
    });

    vi.mocked(getProjectByEnvironmentId).mockResolvedValueOnce({ id: "proj1" } as TProject);
    vi.mocked(getMembershipByUserIdOrganizationId).mockResolvedValueOnce({
      id: "member1",
    } as unknown as TMembership);

    const result = await EnvLayout({
      params: Promise.resolve({ environmentId: "env1" }),
      children: <div data-testid="child">Content</div>,
    });
    render(result);

    expect(screen.getByTestId("ResponseFilterProvider")).toBeDefined();
    expect(screen.getByTestId("PosthogIdentify")).toHaveTextContent("org1");
    expect(screen.getByTestId("FormbricksClient")).toHaveTextContent("user1-user1@example.com");
    expect(screen.getByTestId("ToasterClient")).toBeDefined();
    expect(screen.getByTestId("EnvironmentStorageHandler")).toHaveTextContent("env1");
    expect(screen.getByTestId("EnvironmentLayout")).toBeDefined();
    expect(screen.getByTestId("child")).toHaveTextContent("Content");
  });

  it("throws error if project is not found", async () => {
    vi.mocked(environmentIdLayoutChecks).mockResolvedValueOnce({
      t: ((key: string) => key) as any, // mock translation function does not need to be implemented
      session: { user: { id: "user1" } } as Session,
      user: { id: "user1", email: "user1@example.com" } as TUser,
      organization: {
        id: "org1",
        name: "Org1",
        billing: { plan: "premium" } as unknown as TOrganizationBilling,
      } as TOrganization,
    });

    vi.mocked(getProjectByEnvironmentId).mockResolvedValueOnce(null);
    vi.mocked(getMembershipByUserIdOrganizationId).mockResolvedValueOnce({
      id: "member1",
    } as unknown as TMembership);

    await expect(
      EnvLayout({
        params: Promise.resolve({ environmentId: "env1" }),
        children: <div>Content</div>,
      })
    ).rejects.toThrow("common.project_not_found");
  });

  it("throws error if membership is not found", async () => {
    vi.mocked(environmentIdLayoutChecks).mockResolvedValueOnce({
      t: ((key: string) => key) as any, // mock translation function does not need to be implemented
      session: { user: { id: "user1" } } as Session,
      user: { id: "user1", email: "user1@example.com" } as TUser,
      organization: {
        id: "org1",
        name: "Org1",
        billing: { plan: "premium" } as unknown as TOrganizationBilling,
      } as TOrganization,
    });

    vi.mocked(getProjectByEnvironmentId).mockResolvedValueOnce({ id: "proj1" } as TProject);
    vi.mocked(getMembershipByUserIdOrganizationId).mockResolvedValueOnce(null);

    await expect(
      EnvLayout({
        params: Promise.resolve({ environmentId: "env1" }),
        children: <div>Content</div>,
      })
    ).rejects.toThrow("common.membership_not_found");
  });

  it("calls redirect when user is null", async () => {
    vi.mocked(environmentIdLayoutChecks).mockResolvedValueOnce({
      t: ((key: string) => key) as any, // mock translation function does not need to be implemented
      session: { user: { id: "user1" } } as Session,
      user: undefined as unknown as TUser,
      organization: {
        id: "org1",
        name: "Org1",
        billing: { plan: "premium" } as unknown as TOrganizationBilling,
      } as TOrganization,
    });

    vi.mocked(redirect).mockImplementationOnce(() => {
      throw new Error("Redirect called");
    });

    await expect(
      EnvLayout({
        params: Promise.resolve({ environmentId: "env1" }),
        children: <div>Content</div>,
      })
    ).rejects.toThrow("Redirect called");
  });
});
