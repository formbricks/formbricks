import { canUserAccessOrganization } from "@/lib/organization/auth";
import { getOrganization } from "@/lib/organization/service";
import { getUser } from "@/lib/user/service";
import "@testing-library/jest-dom/vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import React from "react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { TOrganization } from "@formbricks/types/organizations";
import { TUser } from "@formbricks/types/user";
import ProjectOnboardingLayout from "./layout";

// Mock all the modules and functions that this layout uses:

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
  SESSION_MAX_AGE: 1000,
}));

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));
vi.mock("@/lib/organization/auth", () => ({
  canUserAccessOrganization: vi.fn(),
}));
vi.mock("@/lib/organization/service", () => ({
  getOrganization: vi.fn(),
}));
vi.mock("@/lib/user/service", () => ({
  getUser: vi.fn(),
}));
vi.mock("@/tolgee/server", () => ({
  getTranslate: vi.fn(() => {
    // Return a mock translator that just returns the key
    return (key: string) => key;
  }),
}));

// mock the child components
vi.mock("@/app/(app)/environments/[environmentId]/components/PosthogIdentify", () => ({
  PosthogIdentify: () => <div data-testid="posthog-identify" />,
}));
vi.mock("@/modules/ui/components/toaster-client", () => ({
  ToasterClient: () => <div data-testid="toaster-client" />,
}));

describe("ProjectOnboardingLayout", () => {
  beforeEach(() => {
    cleanup();
  });

  test("redirects to /auth/login if there is no session", async () => {
    // Mock no session
    vi.mocked(getServerSession).mockResolvedValueOnce(null);

    const layoutElement = await ProjectOnboardingLayout({
      params: { organizationId: "org-123" },
      children: <div data-testid="child-content">Hello!</div>,
    });

    expect(redirect).toHaveBeenCalledWith("/auth/login");
    // Layout returns nothing after redirect
    expect(layoutElement).toBeUndefined();
  });

  test("throws an error if user does not exist", async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce({
      user: { id: "user-123" },
    });
    vi.mocked(getUser).mockResolvedValueOnce(null); // no user in DB

    await expect(
      ProjectOnboardingLayout({
        params: { organizationId: "org-123" },
        children: <div data-testid="child-content">Hello!</div>,
      })
    ).rejects.toThrow("common.user_not_found");
  });

  test("throws AuthorizationError if user cannot access organization", async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce({ user: { id: "user-123" } });
    vi.mocked(getUser).mockResolvedValueOnce({ id: "user-123" } as TUser);
    vi.mocked(canUserAccessOrganization).mockResolvedValueOnce(false);

    await expect(
      ProjectOnboardingLayout({
        params: { organizationId: "org-123" },
        children: <div data-testid="child-content">Child</div>,
      })
    ).rejects.toThrow("common.not_authorized");
  });

  test("throws an error if organization does not exist", async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce({ user: { id: "user-123" } });
    vi.mocked(getUser).mockResolvedValueOnce({ id: "user-123" } as TUser);
    vi.mocked(canUserAccessOrganization).mockResolvedValueOnce(true);
    vi.mocked(getOrganization).mockResolvedValueOnce(null);

    await expect(
      ProjectOnboardingLayout({
        params: { organizationId: "org-123" },
        children: <div data-testid="child-content">Hello!</div>,
      })
    ).rejects.toThrow("common.organization_not_found");
  });

  test("renders child content plus PosthogIdentify & ToasterClient if everything is valid", async () => {
    // Provide valid data
    vi.mocked(getServerSession).mockResolvedValueOnce({ user: { id: "user-123" } });
    vi.mocked(getUser).mockResolvedValueOnce({ id: "user-123", name: "Test User" } as TUser);
    vi.mocked(canUserAccessOrganization).mockResolvedValueOnce(true);
    vi.mocked(getOrganization).mockResolvedValueOnce({
      id: "org-123",
      name: "Test Org",
      billing: {
        plan: "enterprise",
      },
    } as TOrganization);

    let layoutElement: React.ReactNode;
    // Because it's an async server component, do it in an act
    await act(async () => {
      layoutElement = await ProjectOnboardingLayout({
        params: { organizationId: "org-123" },
        children: <div data-testid="child-content">Hello!</div>,
      });
      render(layoutElement);
    });

    expect(screen.getByTestId("child-content")).toHaveTextContent("Hello!");
    expect(screen.getByTestId("posthog-identify")).toBeInTheDocument();
    expect(screen.getByTestId("toaster-client")).toBeInTheDocument();
  });
});
