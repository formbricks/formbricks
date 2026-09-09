import { beforeEach, describe, expect, test, vi } from "vitest";
import { OperationNotAllowedError, ResourceNotFoundError } from "@formbricks/types/errors";
import {
  assertOrganizationAIConfigured,
  generateOrganizationAIObject,
  generateOrganizationAIText,
  getAISmartToolsUnavailableReason,
  getOrganizationAIConfig,
  isInstanceAIConfigured,
  streamOrganizationAIObject,
} from "./service";

const mocks = vi.hoisted(() => ({
  generateObject: vi.fn(),
  streamObject: vi.fn(),
  generateText: vi.fn(),
  isAiConfigured: vi.fn(),
  classifyAIProviderError: vi.fn(),
  getOrganization: vi.fn(),
  getIsAISmartToolsEnabled: vi.fn(),
  loggerError: vi.fn(),
  wrapAiModelWithTracing: vi.fn(),
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
  generateObject: mocks.generateObject,
  streamObject: mocks.streamObject,
  generateText: mocks.generateText,
  isAiConfigured: mocks.isAiConfigured,
  classifyAIProviderError: mocks.classifyAIProviderError,
}));

vi.mock("@formbricks/logger", () => ({
  logger: {
    error: mocks.loggerError,
  },
}));

vi.mock("@/lib/env", () => ({
  env: {
    AI_PROVIDER: "google",
    AI_MODEL: "gemini-2.5-flash",
    AI_GOOGLE_CLOUD_PROJECT: "google-cloud-project",
    AI_GOOGLE_CLOUD_LOCATION: "us-central1",
    AI_GOOGLE_CLOUD_CREDENTIALS_JSON: undefined,
    AI_GOOGLE_CLOUD_APPLICATION_CREDENTIALS: "/tmp/google-cloud.json",
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
  getIsAISmartToolsEnabled: mocks.getIsAISmartToolsEnabled,
}));

vi.mock("@/lib/posthog/ai-tracing", () => ({
  wrapAiModelWithTracing: mocks.wrapAiModelWithTracing,
}));

describe("AI organization service", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.isAiConfigured.mockReturnValue(true);
    mocks.classifyAIProviderError.mockReturnValue(undefined);
    mocks.getOrganization.mockResolvedValue({
      id: "org_1",
      isAISmartToolsEnabled: true,
    });
    mocks.getIsAISmartToolsEnabled.mockResolvedValue(true);
  });

  test("returns the instance AI status and organization settings", async () => {
    const configured = isInstanceAIConfigured();
    const result = await getOrganizationAIConfig("org_1");

    expect(configured).toBe(true);
    expect(result).toMatchObject({
      organizationId: "org_1",
      isAISmartToolsEnabled: true,
      isAISmartToolsEntitled: true,
      isInstanceConfigured: true,
    });
  });

  test("throws when the organization cannot be found", async () => {
    mocks.getOrganization.mockResolvedValueOnce(null);

    await expect(getOrganizationAIConfig("org_missing")).rejects.toThrow(ResourceNotFoundError);
  });

  test("fails closed when the organization is not entitled to AI", async () => {
    mocks.getIsAISmartToolsEnabled.mockResolvedValueOnce(false);

    await expect(assertOrganizationAIConfigured("org_1")).rejects.toThrow(OperationNotAllowedError);
  });

  test("fails closed when the requested AI capability is disabled", async () => {
    mocks.getOrganization.mockResolvedValueOnce({
      id: "org_1",
      isAISmartToolsEnabled: false,
    });

    await expect(assertOrganizationAIConfigured("org_1")).rejects.toThrow(OperationNotAllowedError);
  });

  test("fails closed when the instance AI configuration is incomplete", async () => {
    mocks.isAiConfigured.mockReturnValueOnce(false);

    await expect(assertOrganizationAIConfigured("org_1")).rejects.toThrow(OperationNotAllowedError);
  });

  test("generates organization AI text with the configured package abstraction", async () => {
    const generatedText = { text: "Translated text" };
    mocks.generateText.mockResolvedValueOnce(generatedText);

    const result = await generateOrganizationAIText({
      organizationId: "org_1",
      prompt: "Translate this survey",
    });

    expect(result).toBe(generatedText);
    expect(mocks.generateText).toHaveBeenCalledWith(
      {
        prompt: "Translate this survey",
      },
      expect.objectContaining({
        AI_PROVIDER: "google",
        AI_MODEL: "gemini-2.5-flash",
        AI_GOOGLE_CLOUD_PROJECT: "google-cloud-project",
      }),
      undefined
    );
  });

  test("wraps the model with PostHog tracing when aiTracing is provided (text)", async () => {
    mocks.generateText.mockResolvedValueOnce({ text: "Translated text" });

    await generateOrganizationAIText({
      organizationId: "org_1",
      aiTracing: { distinctId: "user_1", feature: "ai_survey_generation" },
      prompt: "Translate this survey",
    });

    const wrapModel = mocks.generateText.mock.calls[0][2];
    expect(wrapModel).toBeInstanceOf(Function);

    const rawModel = { providerName: "google" };
    wrapModel(rawModel);
    expect(mocks.wrapAiModelWithTracing).toHaveBeenCalledWith(rawModel, {
      organizationId: "org_1",
      distinctId: "user_1",
      feature: "ai_survey_generation",
    });
  });

  test("generates organization AI objects with the configured package abstraction", async () => {
    const generatedObject = { object: { name: "Generated survey" } };
    const schema = { type: "object" };
    mocks.generateObject.mockResolvedValueOnce(generatedObject);

    const result = await generateOrganizationAIObject<{ name: string }>({
      organizationId: "org_1",
      schema,
      prompt: "Generate a survey",
    } as any);

    expect(result).toBe(generatedObject);
    expect(mocks.generateObject).toHaveBeenCalledWith(
      {
        schema,
        prompt: "Generate a survey",
      },
      expect.objectContaining({
        AI_PROVIDER: "google",
        AI_MODEL: "gemini-2.5-flash",
        AI_GOOGLE_CLOUD_PROJECT: "google-cloud-project",
      }),
      undefined
    );
  });

  test("wraps the model with PostHog tracing when aiTracing is provided (object)", async () => {
    mocks.generateObject.mockResolvedValueOnce({ object: { name: "Generated survey" } });

    await generateOrganizationAIObject({
      organizationId: "org_1",
      aiTracing: { distinctId: "user_1", feature: "ai_chart_query", workspaceId: "ws_1" },
      schema: { type: "object" },
      prompt: "Generate a survey",
    } as any);

    const wrapModel = mocks.generateObject.mock.calls[0][2];
    expect(wrapModel).toBeInstanceOf(Function);

    const rawModel = { providerName: "google" };
    wrapModel(rawModel);
    expect(mocks.wrapAiModelWithTracing).toHaveBeenCalledWith(rawModel, {
      organizationId: "org_1",
      distinctId: "user_1",
      feature: "ai_chart_query",
      workspaceId: "ws_1",
    });
  });

  test("logs and rethrows generation errors", async () => {
    const modelError = new Error("provider boom");
    mocks.generateText.mockRejectedValueOnce(modelError);

    await expect(
      generateOrganizationAIText({
        organizationId: "org_1",
        prompt: "Translate this survey",
      })
    ).rejects.toThrow(modelError);
    expect(mocks.loggerError).toHaveBeenCalledWith(
      {
        organizationId: "org_1",
        isInstanceConfigured: true,
        errorCode: undefined,
        statusCode: undefined,
        isQuotaExhausted: undefined,
        isRetryable: undefined,
        err: modelError,
      },
      "Failed to generate organization AI text"
    );
  });

  test("logs and rethrows object generation errors", async () => {
    const modelError = new Error("provider boom");
    mocks.generateObject.mockRejectedValueOnce(modelError);

    await expect(
      generateOrganizationAIObject({
        organizationId: "org_1",
        schema: { type: "object" },
        prompt: "Generate a survey",
      } as any)
    ).rejects.toThrow(modelError);
    expect(mocks.loggerError).toHaveBeenCalledWith(
      {
        organizationId: "org_1",
        isInstanceConfigured: true,
        errorCode: undefined,
        statusCode: undefined,
        isQuotaExhausted: undefined,
        isRetryable: undefined,
        err: modelError,
      },
      "Failed to generate organization AI object"
    );
  });

  test("converts a provider 429 from text generation into a TooManyRequestsError", async () => {
    const quotaError = new Error("Resource exhausted");
    mocks.generateText.mockRejectedValueOnce(quotaError);
    mocks.classifyAIProviderError.mockReturnValueOnce({
      isQuotaExhausted: true,
      isRetryable: true,
      statusCode: 429,
    });

    await expect(
      generateOrganizationAIText({ organizationId: "org_1", prompt: "Translate this survey" })
    ).rejects.toMatchObject({ name: "TooManyRequestsError", message: "ai_quota_exceeded" });
  });

  test("converts a provider 429 into a TooManyRequestsError with the quota code", async () => {
    const quotaError = new Error("Resource exhausted");
    mocks.generateObject.mockRejectedValueOnce(quotaError);
    mocks.classifyAIProviderError.mockReturnValueOnce({
      isQuotaExhausted: true,
      isRetryable: true,
      statusCode: 429,
      retryAfterSeconds: 30,
    });

    await expect(
      generateOrganizationAIObject({
        organizationId: "org_1",
        schema: { type: "object" },
        prompt: "Generate a survey",
      } as any)
    ).rejects.toMatchObject({ name: "TooManyRequestsError", message: "ai_quota_exceeded", retryAfter: 30 });

    expect(mocks.loggerError).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 429, isQuotaExhausted: true, isRetryable: true }),
      "Failed to generate organization AI object"
    );
  });

  test("rethrows non-quota provider errors unchanged", async () => {
    const serverError = new Error("provider 500");
    mocks.generateObject.mockRejectedValueOnce(serverError);
    mocks.classifyAIProviderError.mockReturnValueOnce({
      isQuotaExhausted: false,
      isRetryable: true,
      statusCode: 500,
    });

    await expect(
      generateOrganizationAIObject({
        organizationId: "org_1",
        schema: { type: "object" },
        prompt: "Generate a survey",
      } as any)
    ).rejects.toBe(serverError);
  });

  describe("streamOrganizationAIObject", () => {
    // Cast rather than `any`: `@formbricks/ai` is mocked here, so the schema is never read — but the
    // input type still requires one.
    const streamInput = () =>
      ({ organizationId: "org_1", prompt: "Generate", schema: { type: "object" } }) as unknown as Parameters<
        typeof streamOrganizationAIObject
      >[0];

    const streamResult = (completion: Promise<unknown>) => {
      // The service hands this promise back untouched; keep it handled so a rejection asserted on
      // later does not surface as an unhandled rejection first.
      completion.catch(() => undefined);
      return { partialObjectStream: {}, completion };
    };

    test("a cancelled generation is not an error: no error log, and the rejection is untouched", async () => {
      // Stop and tab-close both land here. Logging them at error level pages someone for a user
      // doing exactly what the button offers.
      const abortError = new Error("The operation was aborted");
      abortError.name = "AbortError";
      mocks.streamObject.mockReturnValueOnce(streamResult(Promise.reject(abortError)));

      const result = await streamOrganizationAIObject(streamInput());

      await expect(result.completion).rejects.toBe(abortError);
      expect(mocks.loggerError).not.toHaveBeenCalled();
      expect(mocks.classifyAIProviderError).not.toHaveBeenCalled();
    });

    test("an abort wrapped as a cause is recognised too", async () => {
      const abortError = new Error("The operation was aborted");
      abortError.name = "AbortError";
      const wrapped = new Error("stream failed", { cause: abortError });
      mocks.streamObject.mockReturnValueOnce(streamResult(Promise.reject(wrapped)));

      const result = await streamOrganizationAIObject(streamInput());

      await expect(result.completion).rejects.toBe(wrapped);
      expect(mocks.loggerError).not.toHaveBeenCalled();
    });

    test("a real provider failure still logs and maps a 429", async () => {
      const quotaError = new Error("Resource exhausted");
      mocks.classifyAIProviderError.mockReturnValueOnce({
        statusCode: 429,
        isQuotaExhausted: true,
        isRetryable: true,
        retryAfterSeconds: 30,
      });
      mocks.streamObject.mockReturnValueOnce(streamResult(Promise.reject(quotaError)));

      const result = await streamOrganizationAIObject(streamInput());

      await expect(result.completion).rejects.toMatchObject({
        name: "TooManyRequestsError",
        message: "ai_quota_exceeded",
        retryAfter: 30,
      });
      expect(mocks.loggerError).toHaveBeenCalled();
    });
  });

  describe("getAISmartToolsUnavailableReason", () => {
    const baseConfig = {
      organizationId: "org_1",
      isAISmartToolsEntitled: true,
      isAISmartToolsEnabled: true,
      isInstanceConfigured: true,
    };

    test("returns undefined when all checks pass", () => {
      expect(getAISmartToolsUnavailableReason(baseConfig)).toBeUndefined();
    });

    test("returns not_in_plan when smart tools entitlement is missing", () => {
      expect(getAISmartToolsUnavailableReason({ ...baseConfig, isAISmartToolsEntitled: false })).toBe(
        "not_in_plan"
      );
    });

    test("returns not_enabled when smart tools is disabled at org level", () => {
      expect(getAISmartToolsUnavailableReason({ ...baseConfig, isAISmartToolsEnabled: false })).toBe(
        "not_enabled"
      );
    });

    test("returns instance_not_configured when instance AI is missing", () => {
      expect(getAISmartToolsUnavailableReason({ ...baseConfig, isInstanceConfigured: false })).toBe(
        "instance_not_configured"
      );
    });
  });
});
