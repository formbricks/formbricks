import { TeamsPage } from "@/modules/organization/settings/teams/page";
import { describe, expect, test, vi } from "vitest";
import Page from "./page";

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
  FB_LOGO_URL: "mock-fb-logo-url",
  SMTP_HOST: "mock-smtp-host",
  SMTP_PORT: 587,
  SMTP_USER: "mock-smtp-user",
  SMTP_PASSWORD: "mock-smtp-password",
  SESSION_MAX_AGE: 1000,
  REDIS_URL: undefined,
  AUDIT_LOG_ENABLED: 1,
}));

vi.mock("@/lib/env", () => ({
  env: {
    PUBLIC_URL: "https://public-domain.com",
  },
}));

describe("TeamsPage re-export", () => {
  test("should re-export TeamsPage component", () => {
    expect(Page).toBe(TeamsPage);
  });
});
