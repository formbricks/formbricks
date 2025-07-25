import { TSurvey } from "@/modules/survey/list/types/surveys";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { SurveyCard } from "./survey-card";

// Mock constants
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
  SESSION_MAX_AGE: 1000,
  AUDIT_LOG_ENABLED: 1,
  REDIS_URL: "redis://localhost:6379",
}));

describe("SurveyCard", () => {
  const dummySurvey = {
    id: "survey123",
    name: "Test Survey",
    status: "draft",
    responseCount: 0,
    type: "link",
    createdAt: new Date().toString(),
    updatedAt: new Date().toString(),
  };
  const environmentId = "env123";
  const WEBAPP_URL = "http://example.com";
  const mockDeleteSurvey = vi.fn();

  afterEach(() => {
    cleanup();
  });

  test("renders survey card with a draft link when not readOnly", () => {
    render(
      // ...existing code for test wrapper if needed...
      <SurveyCard
        survey={{ ...dummySurvey, status: "draft" } as unknown as TSurvey}
        environmentId={environmentId}
        isReadOnly={false}
        deleteSurvey={mockDeleteSurvey}
        locale="en-US"
        publicDomain={WEBAPP_URL}
      />
    );
    // Draft survey => link should point to edit
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", `/environments/${environmentId}/surveys/${dummySurvey.id}/edit`);
  });

  test("displays no clickable link when readOnly and survey is draft", () => {
    render(
      <SurveyCard
        survey={{ ...dummySurvey, status: "draft" } as unknown as TSurvey}
        environmentId={environmentId}
        isReadOnly={true}
        deleteSurvey={mockDeleteSurvey}
        locale="en-US"
        publicDomain={WEBAPP_URL}
      />
    );
    // When it's read only and draft, we expect no link
    const link = screen.queryByRole("link");
    expect(link).toBeNull();
  });

  test("renders summary link when survey status is not draft", () => {
    render(
      <SurveyCard
        survey={{ ...dummySurvey, status: "inProgress" } as unknown as TSurvey}
        environmentId={environmentId}
        isReadOnly={false}
        deleteSurvey={mockDeleteSurvey}
        locale="en-US"
        publicDomain={WEBAPP_URL}
      />
    );
    // For non-draft => link to summary
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", `/environments/${environmentId}/surveys/${dummySurvey.id}/summary`);
  });
});
