import { SingleContactPage } from "@/modules/ee/contacts/[contactId]/page";
import { describe, expect, test, vi } from "vitest";
import Page from "./page";

// mock constants
vi.mock("@/lib/constants", () => ({
  IS_FORMBRICKS_CLOUD: false,
  ENCRYPTION_KEY: "test",
  ENTERPRISE_LICENSE_KEY: "test",
  GITHUB_ID: "test",
  GITHUB_SECRET: "test",
  GOOGLE_CLIENT_ID: "test",
  GOOGLE_CLIENT_SECRET: "test",
  AZUREAD_CLIENT_ID: "mock-azuread-client-id",
  AZUREAD_CLIENT_SECRET: "mock-azure-client-secret",
  AZUREAD_TENANT_ID: "mock-azuread-tenant-id",
  OIDC_CLIENT_ID: "mock-oidc-client-id",
  OIDC_CLIENT_SECRET: "mock-oidc-client-secret",
  OIDC_ISSUER: "mock-oidc-issuer",
  OIDC_DISPLAY_NAME: "mock-oidc-display-name",
  OIDC_SIGNING_ALGORITHM: "mock-oidc-signing-algorithm",
  WEBAPP_URL: "mock-webapp-url",
  IS_PRODUCTION: true,
  FB_LOGO_URL: "https://example.com/mock-logo.png",
  SMTP_HOST: "mock-smtp-host",
  SMTP_PORT: "mock-smtp-port",
  IS_POSTHOG_CONFIGURED: true,
  SESSION_MAX_AGE: 1000,
  AUDIT_LOG_ENABLED: 1,
  REDIS_URL: "redis://localhost:6379",
}));

describe("Contact Page Re-export", () => {
  test("should re-export SingleContactPage", () => {
    expect(Page).toBe(SingleContactPage);
  });
});
