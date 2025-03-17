import "@testing-library/jest-dom/vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { getServerSession } from "next-auth";
import { notFound, redirect } from "next/navigation";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { hasUserEnvironmentAccess } from "@formbricks/lib/environment/auth";
import { getMembershipByUserIdOrganizationId } from "@formbricks/lib/membership/service";
import { getOrganizationByEnvironmentId } from "@formbricks/lib/organization/service";
import { getProjectByEnvironmentId } from "@formbricks/lib/project/service";
import { getUser } from "@formbricks/lib/user/service";
import { AuthorizationError } from "@formbricks/types/errors";
import { TMembership } from "@formbricks/types/memberships";
import { TOrganization } from "@formbricks/types/organizations";
import { TProject } from "@formbricks/types/project";
import { TUser } from "@formbricks/types/user";
import EnvLayout from "./layout";

// mock all the dependencies

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

vi.mock("@/tolgee/server", () => ({
  getTranslate: vi.fn(() => {
    return (key: string) => {
      return key;
    };
  }),
}));

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));
vi.mock("@formbricks/lib/environment/auth", () => ({
  hasUserEnvironmentAccess: vi.fn(),
}));
vi.mock("@formbricks/lib/membership/service", () => ({
  getMembershipByUserIdOrganizationId: vi.fn(),
}));
vi.mock("@formbricks/lib/organization/service", () => ({
  getOrganizationByEnvironmentId: vi.fn(),
}));
vi.mock("@formbricks/lib/project/service", () => ({
  getProjectByEnvironmentId: vi.fn(),
}));
vi.mock("@formbricks/lib/user/service", () => ({
  getUser: vi.fn(),
}));
vi.mock("@formbricks/lib/aiModels", () => ({
  llmModel: {},
}));

// mock all the components that are rendered in the layout

vi.mock("./components/PosthogIdentify", () => ({
  PosthogIdentify: () => <div data-testid="posthog-identify" />,
}));
vi.mock("@/app/(app)/components/FormbricksClient", () => ({
  FormbricksClient: () => <div data-testid="formbricks-client" />,
}));
vi.mock("@/modules/ui/components/toaster-client", () => ({
  ToasterClient: () => <div data-testid="mock-toaster" />,
}));
vi.mock("./components/EnvironmentStorageHandler", () => ({
  default: () => <div data-testid="mock-storage-handler" />,
}));
vi.mock("@/app/(app)/environments/[environmentId]/components/ResponseFilterContext", () => ({
  ResponseFilterProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="mock-response-filter-provider">{children}</div>
  ),
}));
vi.mock("@/app/(app)/environments/[environmentId]/components/EnvironmentLayout", () => ({
  EnvironmentLayout: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="mock-environment-result">{children}</div>
  ),
}));

describe("EnvLayout", () => {
  beforeEach(() => {
    cleanup();
  });

  it("redirects to /auth/login if there is no session", async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(null);

    // Since it's an async server component, call EnvLayout yourself:
    const layoutElement = await EnvLayout({
      params: Promise.resolve({ environmentId: "env-123" }),
      children: <div data-testid="child-content">Hello!</div>,
    });

    // Because we have no session, we expect a redirect to "/auth/login"
    expect(redirect).toHaveBeenCalledWith("/auth/login");

    // If your code calls redirect() early and returns no JSX,
    // layoutElement might be undefined or null.
    expect(layoutElement).toBeUndefined();
  });

  it("redirects to /auth/login if user does not exist in DB", async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce({
      user: { id: "user-123" },
    });

    vi.mocked(getUser).mockResolvedValueOnce(null); // user not found

    const layoutElement = await EnvLayout({
      params: Promise.resolve({ environmentId: "env-123" }),
      children: <div data-testid="child-content">Hello!</div>,
    });

    expect(redirect).toHaveBeenCalledWith("/auth/login");
    expect(layoutElement).toBeUndefined();
  });

  it("throws AuthorizationError if user does not have environment access", async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce({
      user: { id: "user-123" },
    });
    vi.mocked(getUser).mockResolvedValueOnce({
      id: "user-123",
      email: "test@example.com",
    } as TUser);
    vi.mocked(hasUserEnvironmentAccess).mockResolvedValueOnce(false);

    await expect(
      EnvLayout({
        params: Promise.resolve({ environmentId: "env-123" }),
        children: <div>Child</div>,
      })
    ).rejects.toThrow(AuthorizationError);
  });

  it("throws if no organization is found", async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce({
      user: { id: "user-123" },
    });
    vi.mocked(getUser).mockResolvedValueOnce({
      id: "user-123",
      email: "test@example.com",
    } as TUser);
    vi.mocked(hasUserEnvironmentAccess).mockResolvedValueOnce(true);
    vi.mocked(getOrganizationByEnvironmentId).mockResolvedValueOnce(null);

    await expect(
      EnvLayout({
        params: Promise.resolve({ environmentId: "env-123" }),
        children: <div data-testid="child-content">Hello from children!</div>,
      })
    ).rejects.toThrow("common.organization_not_found");
  });

  it("throws if no project is found", async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce({
      user: { id: "user-123" },
    });
    vi.mocked(getUser).mockResolvedValueOnce({
      id: "user-123",
      email: "test@example.com",
    } as TUser);
    vi.mocked(hasUserEnvironmentAccess).mockResolvedValueOnce(true);
    vi.mocked(getOrganizationByEnvironmentId).mockResolvedValueOnce({ id: "org-999" } as TOrganization);
    vi.mocked(getProjectByEnvironmentId).mockResolvedValueOnce(null);

    await expect(
      EnvLayout({
        params: Promise.resolve({ environmentId: "env-123" }),
        children: <div>Child</div>,
      })
    ).rejects.toThrow("project_not_found");
  });

  it("calls notFound if membership is missing", async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce({
      user: { id: "user-123" },
    });
    vi.mocked(getUser).mockResolvedValueOnce({
      id: "user-123",
      email: "test@example.com",
    } as TUser);
    vi.mocked(hasUserEnvironmentAccess).mockResolvedValueOnce(true);
    vi.mocked(getOrganizationByEnvironmentId).mockResolvedValueOnce({ id: "org-999" } as TOrganization);
    vi.mocked(getProjectByEnvironmentId).mockResolvedValueOnce({ id: "proj-111" } as TProject);
    vi.mocked(getMembershipByUserIdOrganizationId).mockResolvedValueOnce(null);

    const layoutElement = await EnvLayout({
      params: Promise.resolve({ environmentId: "env-123" }),
      children: <div data-testid="child-content">Hello!</div>,
    });

    expect(notFound).toHaveBeenCalled();
    expect(layoutElement).toBeUndefined();
  });

  it("renders environment layout if everything is valid", async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce({
      user: { id: "user-123" },
    });
    vi.mocked(getUser).mockResolvedValueOnce({
      id: "user-123",
      email: "test@example.com",
    } as TUser);
    vi.mocked(hasUserEnvironmentAccess).mockResolvedValueOnce(true);
    vi.mocked(getOrganizationByEnvironmentId).mockResolvedValueOnce({ id: "org-999" } as TOrganization);
    vi.mocked(getProjectByEnvironmentId).mockResolvedValueOnce({ id: "proj-111" } as TProject);
    vi.mocked(getMembershipByUserIdOrganizationId).mockResolvedValueOnce({
      id: "membership-123",
    } as unknown as TMembership);

    let layoutElement: React.ReactNode;

    await act(async () => {
      layoutElement = await EnvLayout({
        params: Promise.resolve({ environmentId: "env-123" }),
        children: <div data-testid="child-content">Hello from children!</div>,
      });

      // Now render the fully resolved layout
      render(layoutElement);
    });

    expect(screen.getByTestId("child-content")).toHaveTextContent("Hello from children!");
    expect(screen.getByTestId("posthog-identify")).toBeInTheDocument();
    expect(screen.getByTestId("formbricks-client")).toBeInTheDocument();
    expect(screen.getByTestId("mock-toaster")).toBeInTheDocument();
    expect(screen.getByTestId("mock-storage-handler")).toBeInTheDocument();
    expect(screen.getByTestId("mock-response-filter-provider")).toBeInTheDocument();
    expect(screen.getByTestId("mock-environment-result")).toBeInTheDocument();
  });
});
