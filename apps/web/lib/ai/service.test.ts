import { beforeEach, describe, expect, test, vi } from "vitest";
import { OperationNotAllowedError, ResourceNotFoundError } from "@formbricks/types/errors";
import {
  assertOrganizationAIConfigured,
  getActiveInstanceAIModel,
  getActiveInstanceAIProvider,
  getInstanceAIConfigStatus,
  getOrganizationAIConfig,
  getOrganizationAILanguageModel,
} from "./service";

const mocks = vi.hoisted(() => ({
  getActiveAiModel: vi.fn(),
  getActiveAiProvider: vi.fn(),
  getAiConfigurationStatus: vi.fn(),
  getAiModel: vi.fn(),
  getOrganization: vi.fn(),
  getIsAIDataAnalysisEnabled: vi.fn(),
  getIsAISmartToolsEnabled: vi.fn(),
  getTranslate: vi.fn(),
  loggerError: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("react", () => ({
  cache: vi.fn((fn) => fn),
}));

vi.mock("@formbricks/ai", () => ({
  AIConfigurationError: class AIConfigurationError extends Error {
    code: string;

    constructor(code: string, message: string) {
      super(message);
      this.code = code;
    }
  },
  getActiveAiModel: mocks.getActiveAiModel,
  getActiveAiProvider: mocks.getActiveAiProvider,
  getAiConfigurationStatus: mocks.getAiConfigurationStatus,
  getAiModel: mocks.getAiModel,
}));

vi.mock("@formbricks/logger", () => ({
  logger: {
    error: mocks.loggerError,
  },
}));

vi.mock("@/lib/env", () => ({
  env: {
    ACTIVE_AI_PROVIDER: "gcp",
    ACTIVE_AI_MODEL: "gemini-2.5-flash",
    GOOGLE_VERTEX_PROJECT: "vertex-project",
    GOOGLE_VERTEX_LOCATION: "us-central1",
    GOOGLE_VERTEX_CREDENTIALS_JSON: undefined,
    GOOGLE_APPLICATION_CREDENTIALS: "/tmp/vertex.json",
    AWS_REGION: "us-east-1",
    AWS_ACCESS_KEY_ID: "aws-access-key-id",
    AWS_SECRET_ACCESS_KEY: "aws-secret-access-key",
    AWS_SESSION_TOKEN: undefined,
    AZURE_BASE_URL: "https://example-resource.openai.azure.com/openai",
    AZURE_RESOURCE_NAME: undefined,
    AZURE_API_KEY: "azure-api-key",
    AZURE_API_VERSION: "v1",
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

    mocks.getActiveAiProvider.mockReturnValue("gcp");
    mocks.getActiveAiModel.mockReturnValue("gemini-2.5-flash");
    mocks.getAiConfigurationStatus.mockReturnValue({
      provider: "gcp",
      model: "gemini-2.5-flash",
      isConfigured: true,
      missingFields: [],
      invalidFields: [],
      providerStatus: {
        provider: "gcp",
        model: "gemini-2.5-flash",
        isConfigured: true,
        missingFields: [],
        invalidFields: [],
      },
    });
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

  test("returns the instance AI config, active provider, active model, and organization settings", async () => {
    const status = getInstanceAIConfigStatus();
    const activeProvider = getActiveInstanceAIProvider();
    const activeModel = getActiveInstanceAIModel();
    const result = await getOrganizationAIConfig("org_1");

    expect(status).toEqual({
      provider: "gcp",
      model: "gemini-2.5-flash",
      isConfigured: true,
      missingFields: [],
      invalidFields: [],
      providerStatus: {
        provider: "gcp",
        model: "gemini-2.5-flash",
        isConfigured: true,
        missingFields: [],
        invalidFields: [],
      },
    });
    expect(activeProvider).toBe("gcp");
    expect(activeModel).toBe("gemini-2.5-flash");
    expect(result).toMatchObject({
      organizationId: "org_1",
      activeProvider: "gcp",
      activeModel: "gemini-2.5-flash",
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
    mocks.getAiConfigurationStatus.mockReturnValueOnce({
      provider: "gcp",
      model: null,
      isConfigured: false,
      missingFields: ["ACTIVE_AI_MODEL"],
      invalidFields: [],
      errorCode: "providerNotConfigured",
      providerStatus: {
        provider: "gcp",
        model: null,
        isConfigured: false,
        missingFields: ["ACTIVE_AI_MODEL"],
        invalidFields: [],
        errorCode: "missingModel",
      },
    });
    mocks.getActiveAiModel.mockReturnValueOnce(null);

    await expect(assertOrganizationAIConfigured("org_1", "smartTools")).rejects.toThrow(
      OperationNotAllowedError
    );
  });

  test("returns the resolved language model when configuration is valid", async () => {
    const mockModel = { provider: "gcp", model: "gemini-2.5-flash" };
    mocks.getAiModel.mockReturnValueOnce(mockModel);

    const result = await getOrganizationAILanguageModel("org_1", "smartTools");

    expect(result).toBe(mockModel);
    expect(mocks.getAiModel).toHaveBeenCalledWith(
      expect.objectContaining({
        ACTIVE_AI_PROVIDER: "gcp",
        ACTIVE_AI_MODEL: "gemini-2.5-flash",
        GOOGLE_VERTEX_PROJECT: "vertex-project",
      })
    );
  });

  test("logs and rethrows model resolution errors", async () => {
    const modelError = new Error("provider boom");
    mocks.getAiModel.mockImplementationOnce(() => {
      throw modelError;
    });

    await expect(getOrganizationAILanguageModel("org_1", "smartTools")).rejects.toThrow(modelError);
    expect(mocks.loggerError).toHaveBeenCalledWith(
      {
        organizationId: "org_1",
        capability: "smartTools",
        provider: "gcp",
        model: "gemini-2.5-flash",
        missingFields: [],
        invalidFields: [],
        errorCode: undefined,
      },
      "Failed to resolve organization AI language model"
    );
  });
});
