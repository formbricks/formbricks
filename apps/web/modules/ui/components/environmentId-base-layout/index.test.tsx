import { cleanup, render, screen } from "@testing-library/react";
import { Session } from "next-auth";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { TOrganization } from "@formbricks/types/organizations";
import { TUser } from "@formbricks/types/user";
import { EnvironmentIdBaseLayout } from "./index";

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
  IS_FORMBRICKS_ENABLED: true,
}));

// Mock sub-components to render identifiable elements
vi.mock("@/app/(app)/environments/[environmentId]/components/ResponseFilterContext", () => ({
  ResponseFilterProvider: ({ children }: any) => <div data-testid="ResponseFilterProvider">{children}</div>,
}));
vi.mock("@/modules/ui/components/toaster-client", () => ({
  ToasterClient: () => <div data-testid="ToasterClient" />,
}));
vi.mock("@/app/(app)/environments/[environmentId]/components/PosthogIdentify", () => ({
  PosthogIdentify: ({ organizationId }: any) => <div data-testid="PosthogIdentify">{organizationId}</div>,
}));

describe("EnvironmentIdBaseLayout", () => {
  test("renders correctly with provided props and children", async () => {
    const dummySession: Session = { user: { id: "user1" } } as Session;
    const dummyUser: TUser = { id: "user1", email: "user1@example.com" } as TUser;
    const dummyOrganization: TOrganization = { id: "org1", name: "Org1", billing: {} } as TOrganization;
    const dummyChildren = <div data-testid="child">Test Content</div>;

    const result = await EnvironmentIdBaseLayout({
      environmentId: "env123",
      session: dummySession,
      user: dummyUser,
      organization: dummyOrganization,
      children: dummyChildren,
    });

    render(result);

    expect(screen.getByTestId("ResponseFilterProvider")).toBeInTheDocument();
    expect(screen.getByTestId("PosthogIdentify")).toHaveTextContent("org1");
    expect(screen.getByTestId("ToasterClient")).toBeInTheDocument();
    expect(screen.getByTestId("child")).toHaveTextContent("Test Content");
  });
});
