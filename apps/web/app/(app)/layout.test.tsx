import { getUser } from "@/lib/user/service";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { getServerSession } from "next-auth";
import { afterEach, describe, expect, test, vi } from "vitest";
import { TUser } from "@formbricks/types/user";
import AppLayout from "./layout";

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

vi.mock("@/lib/user/service", () => ({
  getUser: vi.fn(),
}));

vi.mock("@/lib/constants", () => ({
  INTERCOM_SECRET_KEY: "test-secret-key",
  IS_INTERCOM_CONFIGURED: true,
  INTERCOM_APP_ID: "test-app-id",
  ENCRYPTION_KEY: "test-encryption-key",
  ENTERPRISE_LICENSE_KEY: "test-enterprise-license-key",
  GITHUB_ID: "test-github-id",
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
  IS_POSTHOG_CONFIGURED: true,
  POSTHOG_API_HOST: "test-posthog-api-host",
  POSTHOG_API_KEY: "test-posthog-api-key",
  FORMBRICKS_ENVIRONMENT_ID: "mock-formbricks-environment-id",
  IS_FORMBRICKS_ENABLED: true,
}));

vi.mock("@/app/intercom/IntercomClientWrapper", () => ({
  IntercomClientWrapper: () => <div data-testid="mock-intercom-wrapper" />,
}));
vi.mock("@/modules/ui/components/no-mobile-overlay", () => ({
  NoMobileOverlay: () => <div data-testid="no-mobile-overlay" />,
}));
vi.mock("@/modules/ui/components/toaster-client", () => ({
  ToasterClient: () => <div data-testid="toaster-client" />,
}));

describe("(app) AppLayout", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders child content and all sub-components when user exists", async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce({ user: { id: "user-123" } });
    vi.mocked(getUser).mockResolvedValueOnce({ id: "user-123", email: "test@example.com" } as TUser);

    // Because AppLayout is async, call it like a function
    const element = await AppLayout({
      children: <div data-testid="child-content">Hello from children</div>,
    });

    render(element);

    expect(screen.getByTestId("no-mobile-overlay")).toBeInTheDocument();
    expect(screen.getByTestId("mock-intercom-wrapper")).toBeInTheDocument();
    expect(screen.getByTestId("toaster-client")).toBeInTheDocument();
    expect(screen.getByTestId("child-content")).toHaveTextContent("Hello from children");
  });
});
