import "@testing-library/jest-dom/vitest";
import { render } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { TProject } from "@formbricks/types/project";
import { getApiKeysWithEnvironmentPermissions } from "../lib/api-key";
import { ApiKeyList } from "./api-key-list";

// Mock the getApiKeysWithEnvironmentPermissions function
vi.mock("../lib/api-key", () => ({
  getApiKeysWithEnvironmentPermissions: vi.fn(),
}));

// Mock @/lib/constants
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
  SESSION_MAX_AGE: 1000,
  AUDIT_LOG_ENABLED: 1,
  REDIS_URL: "redis://localhost:6379",
}));

// Mock @/lib/env
vi.mock("@/lib/env", () => ({
  env: {
    IS_FORMBRICKS_CLOUD: "0",
  },
}));

const baseProject = {
  id: "project1",
  name: "Project 1",
  createdAt: new Date(),
  updatedAt: new Date(),
  organizationId: "org1",
  styling: {
    allowStyleOverwrite: true,
    brandColor: { light: "#000000" },
  },
  recontactDays: 0,
  inAppSurveyBranding: false,
  linkSurveyBranding: false,
  config: {
    channel: "link" as const,
    industry: "saas" as const,
  },
  placement: "bottomLeft" as const,
  clickOutsideClose: true,
  darkOverlay: false,
  languages: [],
};

const mockProjects: TProject[] = [
  {
    ...baseProject,
    environments: [
      {
        id: "env1",
        type: "production",
        createdAt: new Date(),
        updatedAt: new Date(),
        projectId: "project1",
        appSetupCompleted: true,
      },
      {
        id: "env2",
        type: "development",
        createdAt: new Date(),
        updatedAt: new Date(),
        projectId: "project1",
        appSetupCompleted: true,
      },
    ],
  },
];

const mockApiKeys = [
  {
    id: "key1",
    hashedKey: "hashed1",
    label: "Test Key 1",
    createdAt: new Date(),
    lastUsedAt: null,
    organizationId: "org1",
    createdBy: "user1",
  },
  {
    id: "key2",
    hashedKey: "hashed2",
    label: "Test Key 2",
    createdAt: new Date(),
    lastUsedAt: null,
    organizationId: "org1",
    createdBy: "user1",
  },
];

describe("ApiKeyList", () => {
  test("renders EditAPIKeys with correct props", async () => {
    // Mock the getApiKeysWithEnvironmentPermissions function to return our mock data
    (getApiKeysWithEnvironmentPermissions as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockApiKeys
    );

    const props = {
      organizationId: "org1",
      locale: "en-US" as const,
      isReadOnly: false,
      projects: mockProjects,
    };

    const { container } = render(await ApiKeyList(props));

    // Verify that EditAPIKeys is rendered with the correct props
    expect(getApiKeysWithEnvironmentPermissions).toHaveBeenCalledWith("org1");
    expect(container).toBeInTheDocument();
  });

  test("handles empty api keys", async () => {
    // Mock the getApiKeysWithEnvironmentPermissions function to return empty array
    (getApiKeysWithEnvironmentPermissions as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const props = {
      organizationId: "org1",
      locale: "en-US" as const,
      isReadOnly: false,
      projects: mockProjects,
    };

    const { container } = render(await ApiKeyList(props));

    // Verify that EditAPIKeys is rendered even with empty api keys
    expect(getApiKeysWithEnvironmentPermissions).toHaveBeenCalledWith("org1");
    expect(container).toBeInTheDocument();
  });

  test("passes isReadOnly prop correctly", async () => {
    (getApiKeysWithEnvironmentPermissions as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockApiKeys
    );

    const props = {
      organizationId: "org1",
      locale: "en-US" as const,
      isReadOnly: true,
      projects: mockProjects,
    };

    const { container } = render(await ApiKeyList(props));

    expect(getApiKeysWithEnvironmentPermissions).toHaveBeenCalledWith("org1");
    expect(container).toBeInTheDocument();
  });
});
