import {
  getIsMultiOrgEnabled,
  getIsOrganizationAIReady,
  getWhiteLabelPermission,
} from "@/modules/ee/license-check/lib/utils";
import { getTranslate } from "@/tolgee/server";
import { getServerSession } from "next-auth";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getMembershipByUserIdOrganizationId } from "@formbricks/lib/membership/service";
import { getAccessFlags } from "@formbricks/lib/membership/utils";
import { getOrganizationByEnvironmentId } from "@formbricks/lib/organization/service";
import { getUser } from "@formbricks/lib/user/service";
import { TMembership } from "@formbricks/types/memberships";
import { TOrganization } from "@formbricks/types/organizations";
import { TUser } from "@formbricks/types/user";
import Page from "./page";

vi.mock("@formbricks/lib/constants", () => ({
  IS_FORMBRICKS_CLOUD: false,
  IS_PRODUCTION: false,
  FB_LOGO_URL: "https://example.com/mock-logo.png",
  ENCRYPTION_KEY: "mock-encryption-key",
  ENTERPRISE_LICENSE_KEY: "mock-enterprise-license-key",
  GITHUB_ID: "mock-github-id",
  GITHUB_SECRET: "mock-github-secret",
  GOOGLE_CLIENT_ID: "mock-google-client-id",
  GOOGLE_CLIENT_SECRET: "mock-google-client-secret",
  AZUREAD_CLIENT_ID: "mock-azuread-client-id",
  AZUREAD_CLIENT_SECRET: "mock-azure-client-secret",
  AZUREAD_TENANT_ID: "mock-azuread-tenant-id",
  OIDC_CLIENT_ID: "mock-oidc-client-id",
  OIDC_CLIENT_SECRET: "mock-oidc-client-secret",
  OIDC_ISSUER: "mock-oidc-issuer",
  OIDC_DISPLAY_NAME: "mock-oidc-display-name",
  OIDC_SIGNING_ALGORITHM: "mock-oidc-signing-algorithm",
  SAML_DATABASE_URL: "mock-saml-database-url",
  WEBAPP_URL: "mock-webapp-url",
  SMTP_HOST: "mock-smtp-host",
  SMTP_PORT: "mock-smtp-port",
  AI_AZURE_LLM_RESSOURCE_NAME: "mock-ai-azure-llm-ressource-name",
  AI_AZURE_LLM_API_KEY: "mock-ai",
  AI_AZURE_LLM_DEPLOYMENT_ID: "mock-ai-azure-llm-deployment-id",
  AI_AZURE_EMBEDDINGS_RESSOURCE_NAME: "mock-ai-azure-embeddings-ressource-name",
  AI_AZURE_EMBEDDINGS_API_KEY: "mock-ai-azure-embeddings-api-key",
  AI_AZURE_EMBEDDINGS_DEPLOYMENT_ID: "mock-ai-azure-embeddings-deployment-id",
}));

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

vi.mock("@/tolgee/server", () => ({
  getTranslate: vi.fn(),
}));

vi.mock("@formbricks/lib/user/service", () => ({
  getUser: vi.fn(),
}));

vi.mock("@formbricks/lib/organization/service", () => ({
  getOrganizationByEnvironmentId: vi.fn(),
}));

vi.mock("@formbricks/lib/membership/service", () => ({
  getMembershipByUserIdOrganizationId: vi.fn(),
}));

vi.mock("@formbricks/lib/membership/utils", () => ({
  getAccessFlags: vi.fn(),
}));

vi.mock("@/modules/ee/license-check/lib/utils", () => ({
  getIsMultiOrgEnabled: vi.fn(),
  getIsOrganizationAIReady: vi.fn(),
  getWhiteLabelPermission: vi.fn(),
}));

describe("Page", () => {
  const mockParams = { environmentId: "test-environment-id" };
  const mockSession = { user: { id: "test-user-id" } };
  const mockUser = { id: "test-user-id" } as TUser;
  const mockOrganization = { id: "test-organization-id", billing: { plan: "free" } } as TOrganization;
  const mockMembership = { role: "owner" } as TMembership;
  const mockTranslate = vi.fn((key) => key);

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getServerSession).mockResolvedValue(mockSession);
    vi.mocked(getTranslate).mockResolvedValue(mockTranslate);
    vi.mocked(getUser).mockResolvedValue(mockUser);
    vi.mocked(getOrganizationByEnvironmentId).mockResolvedValue(mockOrganization);
    vi.mocked(getMembershipByUserIdOrganizationId).mockResolvedValue(mockMembership);
    vi.mocked(getAccessFlags).mockReturnValue({
      isOwner: true,
      isManager: false,
      isBilling: false,
      isMember: false,
    });
    vi.mocked(getIsMultiOrgEnabled).mockResolvedValue(true);
    vi.mocked(getIsOrganizationAIReady).mockResolvedValue(true);
    vi.mocked(getWhiteLabelPermission).mockResolvedValue(true);
  });

  it("renders the page with organization settings", async () => {
    const props = {
      params: Promise.resolve({ environmentId: "env-123" }),
    };

    const result = await Page(props);

    expect(result).toBeTruthy();
  });

  it("renders if session user id is null", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: null } });

    const props = {
      params: Promise.resolve({ environmentId: "env-123" }),
    };

    const result = await Page(props);

    expect(result).toBeTruthy();
  });

  it("throws an error if the session is not found", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);

    await expect(Page({ params: Promise.resolve(mockParams) })).rejects.toThrow("common.session_not_found");
  });

  it("throws an error if the organization is not found", async () => {
    vi.mocked(getOrganizationByEnvironmentId).mockResolvedValue(null);

    await expect(Page({ params: Promise.resolve(mockParams) })).rejects.toThrow(
      "common.organization_not_found"
    );
  });
});
