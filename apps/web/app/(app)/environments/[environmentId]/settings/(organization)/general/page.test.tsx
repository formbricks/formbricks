import { getEnvironmentAuth } from "@/modules/environments/lib/utils";
import { TEnvironmentAuth } from "@/modules/environments/types/environment-auth";
import { getTranslate } from "@/tolgee/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getUser } from "@formbricks/lib/user/service";
import { TUser } from "@formbricks/types/user";
import Page from "./page";

vi.mock("@formbricks/lib/constants", () => ({
  IS_FORMBRICKS_CLOUD: false,
  IS_PRODUCTION: false,
  FB_LOGO_URL: "https://example.com/mock-logo.png",
  ENCRYPTION_KEY: "mock-encryption-key",
  WEBAPP_URL: "mock-webapp-url",
  SMTP_HOST: "mock-smtp-host",
  SMTP_PORT: "mock-smtp-port",
  AI_AZURE_LLM_RESSOURCE_NAME: "mock-azure-llm-resource-name",
  AI_AZURE_LLM_API_KEY: "mock-azure-llm-api-key",
  AI_AZURE_LLM_DEPLOYMENT_ID: "mock-azure-llm-deployment-id",
  AI_AZURE_EMBEDDINGS_RESSOURCE_NAME: "mock-azure-embeddings-resource-name",
  AI_AZURE_EMBEDDINGS_API_KEY: "mock-azure-embeddings-api-key",
  AI_AZURE_EMBEDDINGS_DEPLOYMENT_ID: "mock-azure-embeddings-deployment-id",
}));

vi.mock("@/tolgee/server", () => ({
  getTranslate: vi.fn(),
}));

vi.mock("@formbricks/lib/user/service", () => ({
  getUser: vi.fn(),
}));

vi.mock("@/modules/environments/lib/utils", () => ({
  getEnvironmentAuth: vi.fn(),
}));

describe("Page", () => {
  let mockEnvironmentAuth = {
    session: { user: { id: "test-user-id" } },
    currentUserMembership: { role: "owner" },
    organization: { id: "test-organization-id", billing: { plan: "free" } },
    isOwner: true,
    isManager: false,
  } as unknown as TEnvironmentAuth;

  const mockUser = { id: "test-user-id" } as TUser;
  const mockTranslate = vi.fn((key) => key);

  beforeEach(() => {
    vi.mocked(getTranslate).mockResolvedValue(mockTranslate);
    vi.mocked(getUser).mockResolvedValue(mockUser);
    vi.mocked(getEnvironmentAuth).mockResolvedValue(mockEnvironmentAuth);
  });

  it("renders the page with organization settings", async () => {
    const props = {
      params: Promise.resolve({ environmentId: "env-123" }),
    };

    const result = await Page(props);

    expect(result).toBeTruthy();
  });

  it("renders if session user id empty", async () => {
    mockEnvironmentAuth.session.user.id = "";

    vi.mocked(getEnvironmentAuth).mockResolvedValue(mockEnvironmentAuth);

    const props = {
      params: Promise.resolve({ environmentId: "env-123" }),
    };

    const result = await Page(props);

    expect(result).toBeTruthy();
  });

  it("handles getEnvironmentAuth error", async () => {
    vi.mocked(getEnvironmentAuth).mockRejectedValue(new Error("Authentication error"));

    const props = {
      params: Promise.resolve({ environmentId: "env-123" }),
    };

    await expect(Page(props)).rejects.toThrow("Authentication error");
  });
});
