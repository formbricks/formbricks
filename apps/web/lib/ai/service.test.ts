import { beforeEach, describe, expect, test, vi } from "vitest";
import { OperationNotAllowedError, ResourceNotFoundError } from "@formbricks/types/errors";
import {
  assertOrganizationAIConfigured,
  generateOrganizationAIText,
  getOrganizationAIConfig,
  isInstanceAIConfigured,
} from "./service";

const mocks = vi.hoisted(() => ({
  generateText: vi.fn(),
  isAiConfigured: vi.fn(),
  getOrganization: vi.fn(),
  getIsAIDataAnalysisEnabled: vi.fn(),
  getIsAISmartToolsEnabled: vi.fn(),
  getTranslate: vi.fn(),
  loggerError: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("@formbricks/ai", () => ({
  AIConfigurationError: class AIConfigurationError extends Error {
    code: string;

    constructor(code: string, message: string) {
      super(message);
      this.code = code;
    }
  },
  generateText: mocks.generateText,
  isAiConfigured: mocks.isAiConfigured,
}));

vi.mock("@formbricks/logger", () => ({
  logger: {
    error: mocks.loggerError,
  },
}));

vi.mock("@/lib/env", () => ({
  env: {
    AI_PROVIDER: "gcp",
    AI_MODEL: "gemini-2.5-flash",
    AI_GCP_PROJECT: "vertex-project",
    AI_GCP_LOCATION: "us-central1",
    AI_GCP_CREDENTIALS_JSON: undefined,
    AI_GCP_APPLICATION_CREDENTIALS: "/tmp/vertex.json",
    AI_AWS_REGION: "us-east-1",
    AI_AWS_ACCESS_KEY_ID: "aws-access-key-id",
    AI_AWS_SECRET_ACCESS_KEY: "aws-secret-access-key",
    AI_AWS_SESSION_TOKEN: undefined,
    AI_AZURE_BASE_URL: "https://example-resource.openai.azure.com/openai",
    AI_AZURE_RESOURCE_NAME: undefined,
    AI_AZURE_API_KEY: "azure-api-key",
    AI_AZURE_API_VERSION: "v1",
  },
}));

vi.mock("@/lib/organization/service", () => ({
  getOrganization: mocks.getOrganization,
}));

vi.mock("@/modules/ee/license-check/lib/utils", () => ({
  getIsAIDataAnalysisEnabled: mocks.getIsAIDataAnalysisEnabled,
  getIsAISmartToolsEnabled: mocks.getIsAISmartToolsEnabled,
}));

vi.mock("@/lingodotdev/server", () => ({
  getTranslate: mocks.getTranslate,
}));

describe("AI organization service", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.isAiConfigured.mockReturnValue(true);
    mocks.getOrganization.mockResolvedValue({
      id: "org_1",
      isAISmartToolsEnabled: true,
      isAIDataAnalysisEnabled: false,
    });
    mocks.getIsAISmartToolsEnabled.mockResolvedValue(true);
    mocks.getIsAIDataAnalysisEnabled.mockResolvedValue(true);
    mocks.getTranslate.mockResolvedValue((key: string, values?: Record<string, string>) =>
      values ? `${key}:${JSON.stringify(values)}` : key
    );
  });

  test("returns the instance AI status and organization settings", async () => {
    const configured = isInstanceAIConfigured();
    const result = await getOrganizationAIConfig("org_1");

    expect(configured).toBe(true);
    expect(result).toMatchObject({
      organizationId: "org_1",
      isAISmartToolsEnabled: true,
      isAIDataAnalysisEnabled: false,
      isAISmartToolsEntitled: true,
      isAIDataAnalysisEntitled: true,
      isInstanceConfigured: true,
    });
  });

  test("throws when the organization cannot be found", async () => {
    mocks.getOrganization.mockResolvedValueOnce(null);

    await expect(getOrganizationAIConfig("org_missing")).rejects.toThrow(ResourceNotFoundError);
  });

  test("fails closed when the organization is not entitled to AI", async () => {
    mocks.getIsAISmartToolsEnabled.mockResolvedValueOnce(false);

    await expect(assertOrganizationAIConfigured("org_1", "smartTools")).rejects.toThrow(
      OperationNotAllowedError
    );
  });

  test("fails closed when the requested AI capability is disabled", async () => {
    mocks.getOrganization.mockResolvedValueOnce({
      id: "org_1",
      isAISmartToolsEnabled: false,
      isAIDataAnalysisEnabled: true,
    });

    await expect(assertOrganizationAIConfigured("org_1", "smartTools")).rejects.toThrow(
      OperationNotAllowedError
    );
  });

  test("fails closed when the instance AI configuration is incomplete", async () => {
    mocks.isAiConfigured.mockReturnValueOnce(false);

    await expect(assertOrganizationAIConfigured("org_1", "smartTools")).rejects.toThrow(
      OperationNotAllowedError
    );
  });

  test("generates organization AI text with the configured package abstraction", async () => {
    const generatedText = { text: "Translated text" };
    mocks.generateText.mockResolvedValueOnce(generatedText);

    const result = await generateOrganizationAIText({
      organizationId: "org_1",
      capability: "smartTools",
      prompt: "Translate this survey",
    });

    expect(result).toBe(generatedText);
    expect(mocks.generateText).toHaveBeenCalledWith(
      {
        prompt: "Translate this survey",
      },
      expect.objectContaining({
        AI_PROVIDER: "gcp",
        AI_MODEL: "gemini-2.5-flash",
        AI_GCP_PROJECT: "vertex-project",
      })
    );
  });

  test("logs and rethrows generation errors", async () => {
    const modelError = new Error("provider boom");
    mocks.generateText.mockRejectedValueOnce(modelError);

    await expect(
      generateOrganizationAIText({
        organizationId: "org_1",
        capability: "smartTools",
        prompt: "Translate this survey",
      })
    ).rejects.toThrow(modelError);
    expect(mocks.loggerError).toHaveBeenCalledWith(
      {
        organizationId: "org_1",
        capability: "smartTools",
        isInstanceConfigured: true,
        errorCode: undefined,
        err: modelError,
      },
      "Failed to generate organization AI text"
    );
  });
});
