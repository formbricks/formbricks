import "@testing-library/jest-dom/vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { hasUserEnvironmentAccess } from "@formbricks/lib/environment/auth";
import { getEnvironment } from "@formbricks/lib/environment/service";
import { getOrganizationByEnvironmentId } from "@formbricks/lib/organization/service";
import { getUser } from "@formbricks/lib/user/service";
import { TEnvironment } from "@formbricks/types/environment";
import { AuthorizationError } from "@formbricks/types/errors";
import { TOrganization } from "@formbricks/types/organizations";
import { TUser } from "@formbricks/types/user";
import SurveyEditorEnvironmentLayout from "./layout";

// mock all dependencies

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
}));

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));
vi.mock("@formbricks/lib/environment/auth", () => ({
  hasUserEnvironmentAccess: vi.fn(),
}));
vi.mock("@formbricks/lib/environment/service", () => ({
  getEnvironment: vi.fn(),
}));
vi.mock("@formbricks/lib/organization/service", () => ({
  getOrganizationByEnvironmentId: vi.fn(),
}));
vi.mock("@formbricks/lib/user/service", () => ({
  getUser: vi.fn(),
}));
vi.mock("@/tolgee/server", () => ({
  getTranslate: vi.fn(() => {
    return (key: string) => key; // trivial translator returning the key
  }),
}));

// mock child components rendered by the layout:
vi.mock("@/app/(app)/components/FormbricksClient", () => ({
  FormbricksClient: () => <div data-testid="formbricks-client" />,
}));
vi.mock("@/app/(app)/environments/[environmentId]/components/PosthogIdentify", () => ({
  PosthogIdentify: () => <div data-testid="posthog-identify" />,
}));
vi.mock("@/modules/ui/components/toaster-client", () => ({
  ToasterClient: () => <div data-testid="mock-toaster" />,
}));
vi.mock("@/modules/ui/components/dev-environment-banner", () => ({
  DevEnvironmentBanner: ({ environment }: { environment: TEnvironment }) => (
    <div data-testid="dev-environment-banner">{environment?.id || "no-env"}</div>
  ),
}));
vi.mock("@/app/(app)/environments/[environmentId]/components/ResponseFilterContext", () => ({
  ResponseFilterProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="mock-response-filter-provider">{children}</div>
  ),
}));

describe("SurveyEditorEnvironmentLayout", () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("redirects to /auth/login if there is no session", async () => {
    // Mock no session
    vi.mocked(getServerSession).mockResolvedValueOnce(null);

    const layoutElement = await SurveyEditorEnvironmentLayout({
      params: { environmentId: "env-123" },
      children: <div data-testid="child-content">Hello!</div>,
    });

    expect(redirect).toHaveBeenCalledWith("/auth/login");
    // No JSX is returned after redirect
    expect(layoutElement).toBeUndefined();
  });

  it("throws error if user does not exist in DB", async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce({ user: { id: "user-123" } });
    vi.mocked(getUser).mockResolvedValueOnce(null); // user not found

    await expect(
      SurveyEditorEnvironmentLayout({
        params: { environmentId: "env-123" },
        children: <div data-testid="child-content">Hello!</div>,
      })
    ).rejects.toThrow("common.user_not_found");
  });

  it("throws AuthorizationError if user does not have environment access", async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce({ user: { id: "user-123" } });
    vi.mocked(getUser).mockResolvedValueOnce({ id: "user-123", email: "test@example.com" } as TUser);
    vi.mocked(hasUserEnvironmentAccess).mockResolvedValueOnce(false);

    await expect(
      SurveyEditorEnvironmentLayout({
        params: { environmentId: "env-123" },
        children: <div>Child</div>,
      })
    ).rejects.toThrow(AuthorizationError);
  });

  it("throws if no organization is found", async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce({ user: { id: "user-123" } });
    vi.mocked(getUser).mockResolvedValueOnce({ id: "user-123" } as TUser);
    vi.mocked(hasUserEnvironmentAccess).mockResolvedValueOnce(true);
    vi.mocked(getOrganizationByEnvironmentId).mockResolvedValueOnce(null);

    await expect(
      SurveyEditorEnvironmentLayout({
        params: { environmentId: "env-123" },
        children: <div data-testid="child-content">Hello from children!</div>,
      })
    ).rejects.toThrow("common.organization_not_found");
  });

  it("throws if no environment is found", async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce({ user: { id: "user-123" } });
    vi.mocked(getUser).mockResolvedValueOnce({ id: "user-123" } as TUser);
    vi.mocked(hasUserEnvironmentAccess).mockResolvedValueOnce(true);
    vi.mocked(getOrganizationByEnvironmentId).mockResolvedValueOnce({ id: "org-999" } as TOrganization);
    vi.mocked(getEnvironment).mockResolvedValueOnce(null);

    await expect(
      SurveyEditorEnvironmentLayout({
        params: { environmentId: "env-123" },
        children: <div>Child</div>,
      })
    ).rejects.toThrow("common.environment_not_found");
  });

  it("renders environment layout if everything is valid", async () => {
    // Provide all valid data
    vi.mocked(getServerSession).mockResolvedValueOnce({ user: { id: "user-123" } });
    vi.mocked(getUser).mockResolvedValueOnce({ id: "user-123", email: "test@example.com" } as TUser);
    vi.mocked(hasUserEnvironmentAccess).mockResolvedValueOnce(true);
    vi.mocked(getOrganizationByEnvironmentId).mockResolvedValueOnce({ id: "org-999" } as TOrganization);
    vi.mocked(getEnvironment).mockResolvedValueOnce({
      id: "env-123",
      name: "My Test Environment",
    } as unknown as TEnvironment);

    // Because it's an async server component, we typically wrap in act(...)
    let layoutElement: React.ReactNode;

    await act(async () => {
      layoutElement = await SurveyEditorEnvironmentLayout({
        params: { environmentId: "env-123" },
        children: <div data-testid="child-content">Hello from children!</div>,
      });
      render(layoutElement);
    });

    // Now confirm we got the child plus all the mocked sub-components
    expect(screen.getByTestId("child-content")).toHaveTextContent("Hello from children!");
    expect(screen.getByTestId("posthog-identify")).toBeInTheDocument();
    expect(screen.getByTestId("formbricks-client")).toBeInTheDocument();
    expect(screen.getByTestId("mock-toaster")).toBeInTheDocument();
    expect(screen.getByTestId("mock-response-filter-provider")).toBeInTheDocument();
    expect(screen.getByTestId("dev-environment-banner")).toHaveTextContent("env-123");
  });
});
