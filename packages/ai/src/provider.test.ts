import { type Mock, beforeEach, describe, expect, test, vi } from "vitest";
import {
  AIConfigurationError,
  getActiveAiModel,
  getActiveAiProvider,
  getAiConfigurationStatus,
  getAiModel,
  isAiConfigured,
  resetLanguageModelCache,
} from "./provider";
import type { AIEnvironment } from "./types";

const mocks = vi.hoisted(() => ({
  createAmazonBedrock: vi.fn(),
  createAzure: vi.fn(),
  createVertex: vi.fn(),
  createOpenAICompatible: vi.fn(),
}));

vi.mock("@ai-sdk/google-vertex", () => ({
  createVertex: mocks.createVertex,
}));

vi.mock("@ai-sdk/amazon-bedrock", () => ({
  createAmazonBedrock: mocks.createAmazonBedrock,
}));

vi.mock("@ai-sdk/azure", () => ({
  createAzure: mocks.createAzure,
}));

vi.mock("@ai-sdk/openai-compatible", () => ({
  createOpenAICompatible: mocks.createOpenAICompatible,
}));

const createMockProvider = (
  providerName: string
): Mock<(modelName: string) => { providerName: string; modelName: string }> =>
  vi.fn((modelName: string) => ({
    providerName,
    modelName,
  }));

describe("packages/ai provider helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetLanguageModelCache();
  });

  test("resolves the active provider from the environment", () => {
    expect(
      getActiveAiProvider({
        AI_PROVIDER: " google ",
      })
    ).toBe("google");
  });

  test("resolves the active model from the environment", () => {
    expect(
      getActiveAiModel({
        AI_MODEL: " gemini-2.5-flash ",
      })
    ).toBe("gemini-2.5-flash");
  });

  test("reports a fully configured Google Cloud instance when the active provider credentials and model are valid", () => {
    expect(
      getAiConfigurationStatus({
        AI_PROVIDER: "google",
        AI_MODEL: "gemini-2.5-flash",
        AI_GOOGLE_CLOUD_PROJECT: "test-project",
        AI_GOOGLE_CLOUD_LOCATION: "us-central1",
        AI_GOOGLE_CLOUD_CREDENTIALS_JSON: JSON.stringify({ client_email: "google@example.com" }),
      })
    ).toEqual({
      provider: "google",
      model: "gemini-2.5-flash",
      isConfigured: true,
      missingFields: [],
      invalidFields: [],
      providerStatus: {
        provider: "google",
        model: "gemini-2.5-flash",
        isConfigured: true,
        missingFields: [],
        invalidFields: [],
      },
    });
  });

  test("reports a fully configured Google Cloud instance when ADC provides credentials", () => {
    expect(
      getAiConfigurationStatus({
        AI_PROVIDER: "google",
        AI_MODEL: "gemini-2.5-flash",
        AI_GOOGLE_CLOUD_PROJECT: "test-project",
        AI_GOOGLE_CLOUD_LOCATION: "us-central1",
      })
    ).toEqual({
      provider: "google",
      model: "gemini-2.5-flash",
      isConfigured: true,
      missingFields: [],
      invalidFields: [],
      providerStatus: {
        provider: "google",
        model: "gemini-2.5-flash",
        isConfigured: true,
        missingFields: [],
        invalidFields: [],
      },
    });
  });

  test("treats the instance as not configured when AI_PROVIDER is missing", () => {
    expect(
      isAiConfigured({
        AI_MODEL: "gemini-2.5-flash",
        AI_GOOGLE_CLOUD_PROJECT: "test-project",
        AI_GOOGLE_CLOUD_LOCATION: "us-central1",
        AI_GOOGLE_CLOUD_APPLICATION_CREDENTIALS: "/tmp/google-cloud.json",
      })
    ).toBe(false);
  });

  test("treats the instance as not configured when AI_PROVIDER is unsupported", () => {
    expect(
      getAiConfigurationStatus({
        AI_PROVIDER: "openai",
      })
    ).toMatchObject({
      provider: null,
      model: null,
      isConfigured: false,
      invalidFields: ["AI_PROVIDER"],
      errorCode: "invalidProvider",
    });
  });

  test("treats the instance as not configured when the active model is missing", () => {
    expect(
      getAiConfigurationStatus({
        AI_PROVIDER: "aws",
        AI_AWS_REGION: "us-east-1",
        AI_AWS_ACCESS_KEY_ID: "aws-access-key-id",
        AI_AWS_SECRET_ACCESS_KEY: "aws-secret-access-key",
      })
    ).toMatchObject({
      provider: "aws",
      model: null,
      isConfigured: false,
      missingFields: ["AI_MODEL"],
      errorCode: "providerNotConfigured",
    });
  });

  test("treats the instance as not configured when the selected provider is missing credentials", () => {
    expect(
      getAiConfigurationStatus({
        AI_PROVIDER: "azure",
        AI_MODEL: "gpt-4.1",
        AI_AZURE_RESOURCE_NAME: "test-resource",
      })
    ).toMatchObject({
      provider: "azure",
      model: "gpt-4.1",
      isConfigured: false,
      missingFields: ["AI_AZURE_API_KEY"],
      errorCode: "providerNotConfigured",
    });
  });

  test("treats the instance as not configured when Google Cloud credentials JSON is invalid", () => {
    expect(
      getAiConfigurationStatus({
        AI_PROVIDER: "google",
        AI_MODEL: "gemini-2.5-flash",
        AI_GOOGLE_CLOUD_PROJECT: "test-project",
        AI_GOOGLE_CLOUD_LOCATION: "us-central1",
        AI_GOOGLE_CLOUD_CREDENTIALS_JSON: "{not-json}",
      })
    ).toMatchObject({
      provider: "google",
      model: "gemini-2.5-flash",
      isConfigured: false,
      invalidFields: ["AI_GOOGLE_CLOUD_CREDENTIALS_JSON"],
      errorCode: "providerNotConfigured",
    });
  });

  test("treats the instance as not configured when Google Cloud credentials JSON is not an object", () => {
    expect(
      getAiConfigurationStatus({
        AI_PROVIDER: "google",
        AI_MODEL: "gemini-2.5-flash",
        AI_GOOGLE_CLOUD_PROJECT: "test-project",
        AI_GOOGLE_CLOUD_LOCATION: "us-central1",
        AI_GOOGLE_CLOUD_CREDENTIALS_JSON: "[]",
      })
    ).toMatchObject({
      provider: "google",
      model: "gemini-2.5-flash",
      isConfigured: false,
      invalidFields: ["AI_GOOGLE_CLOUD_CREDENTIALS_JSON"],
      errorCode: "providerNotConfigured",
    });
  });

  test("creates and caches a Google Cloud model with parsed JSON credentials", () => {
    const vertexProvider = createMockProvider("google");
    mocks.createVertex.mockReturnValue(vertexProvider);

    const environment: AIEnvironment = {
      AI_PROVIDER: "google",
      AI_MODEL: "gemini-2.5-flash",
      AI_GOOGLE_CLOUD_PROJECT: "test-project",
      AI_GOOGLE_CLOUD_LOCATION: "us-central1",
      AI_GOOGLE_CLOUD_CREDENTIALS_JSON: JSON.stringify({ client_email: "google@example.com" }),
    };

    const firstModel = getAiModel(environment);
    const secondModel = getAiModel(environment);

    expect(firstModel).toEqual({ providerName: "google", modelName: "gemini-2.5-flash" });
    expect(secondModel).toBe(firstModel);
    expect(mocks.createVertex).toHaveBeenCalledWith({
      project: "test-project",
      location: "us-central1",
      googleAuthOptions: {
        credentials: {
          client_email: "google@example.com",
        },
      },
    });
    expect(vertexProvider).toHaveBeenCalledWith("gemini-2.5-flash");
    expect(mocks.createVertex).toHaveBeenCalledTimes(1);
  });

  test("creates a Google Cloud model with application credentials file", () => {
    const vertexProvider = createMockProvider("google");
    mocks.createVertex.mockReturnValue(vertexProvider);

    const model = getAiModel({
      AI_PROVIDER: "google",
      AI_MODEL: "gemini-2.5-flash",
      AI_GOOGLE_CLOUD_PROJECT: "test-project",
      AI_GOOGLE_CLOUD_LOCATION: "us-central1",
      AI_GOOGLE_CLOUD_APPLICATION_CREDENTIALS: "/tmp/google-cloud.json",
    });

    expect(model).toEqual({ providerName: "google", modelName: "gemini-2.5-flash" });
    expect(mocks.createVertex).toHaveBeenCalledWith({
      project: "test-project",
      location: "us-central1",
      googleAuthOptions: {
        keyFilename: "/tmp/google-cloud.json",
      },
    });
    expect(vertexProvider).toHaveBeenCalledWith("gemini-2.5-flash");
  });

  test("creates a Google Cloud model using ADC when no credential override is configured", () => {
    const vertexProvider = createMockProvider("google");
    mocks.createVertex.mockReturnValue(vertexProvider);

    const model = getAiModel({
      AI_PROVIDER: "google",
      AI_MODEL: "gemini-2.5-flash",
      AI_GOOGLE_CLOUD_PROJECT: "test-project",
      AI_GOOGLE_CLOUD_LOCATION: "us-central1",
    });

    expect(model).toEqual({ providerName: "google", modelName: "gemini-2.5-flash" });
    expect(mocks.createVertex).toHaveBeenCalledWith({
      project: "test-project",
      location: "us-central1",
    });
    expect(vertexProvider).toHaveBeenCalledWith("gemini-2.5-flash");
  });

  test.each([
    [
      "us",
      "https://aiplatform.us.rep.googleapis.com/v1/projects/test-project/locations/us/publishers/google",
    ],
    [
      "eu",
      "https://aiplatform.eu.rep.googleapis.com/v1/projects/test-project/locations/eu/publishers/google",
    ],
  ])("creates a Google Cloud model with the %s multi-region endpoint", (location, baseURL) => {
    const vertexProvider = createMockProvider("google");
    mocks.createVertex.mockReturnValue(vertexProvider);

    const model = getAiModel({
      AI_PROVIDER: "google",
      AI_MODEL: "gemini-3.5-flash",
      AI_GOOGLE_CLOUD_PROJECT: "test-project",
      AI_GOOGLE_CLOUD_LOCATION: location,
    });

    expect(model).toEqual({ providerName: "google", modelName: "gemini-3.5-flash" });
    expect(mocks.createVertex).toHaveBeenCalledWith({
      project: "test-project",
      location,
      baseURL,
    });
    expect(vertexProvider).toHaveBeenCalledWith("gemini-3.5-flash");
  });

  test.each(["global", "europe-west3", "me-central2"])(
    "keeps the SDK default Google Cloud endpoint for the %s location",
    (location) => {
      const vertexProvider = createMockProvider("google");
      mocks.createVertex.mockReturnValue(vertexProvider);

      const model = getAiModel({
        AI_PROVIDER: "google",
        AI_MODEL: "gemini-3.5-flash",
        AI_GOOGLE_CLOUD_PROJECT: "test-project",
        AI_GOOGLE_CLOUD_LOCATION: location,
      });

      expect(model).toEqual({ providerName: "google", modelName: "gemini-3.5-flash" });
      expect(mocks.createVertex).toHaveBeenCalledWith({
        project: "test-project",
        location,
      });
      expect(vertexProvider).toHaveBeenCalledWith("gemini-3.5-flash");
    }
  );

  test("does not reuse a cached Google Cloud model after credentials change", () => {
    const firstVertexProvider = createMockProvider("google");
    const secondVertexProvider = createMockProvider("google");
    mocks.createVertex.mockReturnValueOnce(firstVertexProvider).mockReturnValueOnce(secondVertexProvider);

    const firstModel = getAiModel({
      AI_PROVIDER: "google",
      AI_MODEL: "gemini-3.5-flash",
      AI_GOOGLE_CLOUD_PROJECT: "test-project",
      AI_GOOGLE_CLOUD_LOCATION: "eu",
      AI_GOOGLE_CLOUD_CREDENTIALS_JSON: JSON.stringify({ client_email: "first@example.com" }),
    });
    const secondModel = getAiModel({
      AI_PROVIDER: "google",
      AI_MODEL: "gemini-3.5-flash",
      AI_GOOGLE_CLOUD_PROJECT: "test-project",
      AI_GOOGLE_CLOUD_LOCATION: "eu",
      AI_GOOGLE_CLOUD_CREDENTIALS_JSON: JSON.stringify({ client_email: "second@example.com" }),
    });

    expect(firstModel).toEqual({ providerName: "google", modelName: "gemini-3.5-flash" });
    expect(secondModel).toEqual({ providerName: "google", modelName: "gemini-3.5-flash" });
    expect(secondModel).not.toBe(firstModel);
    expect(mocks.createVertex).toHaveBeenCalledTimes(2);
  });

  test("creates an AWS model with explicit AWS credentials", () => {
    const bedrockProvider = createMockProvider("aws");
    mocks.createAmazonBedrock.mockReturnValue(bedrockProvider);

    const model = getAiModel({
      AI_PROVIDER: "aws",
      AI_MODEL: "amazon.nova-lite-v1:0",
      AI_AWS_REGION: "us-east-1",
      AI_AWS_ACCESS_KEY_ID: "aws-access-key-id",
      AI_AWS_SECRET_ACCESS_KEY: "aws-secret-access-key",
      AI_AWS_SESSION_TOKEN: "aws-session-token",
    });

    expect(model).toEqual({ providerName: "aws", modelName: "amazon.nova-lite-v1:0" });
    expect(mocks.createAmazonBedrock).toHaveBeenCalledWith({
      region: "us-east-1",
      accessKeyId: "aws-access-key-id",
      secretAccessKey: "aws-secret-access-key",
      sessionToken: "aws-session-token",
    });
  });

  test("creates an Azure model using the configured resource name", () => {
    const azureProvider = createMockProvider("azure");
    mocks.createAzure.mockReturnValue(azureProvider);

    const model = getAiModel({
      AI_PROVIDER: "azure",
      AI_MODEL: "gpt-4.1",
      AI_AZURE_RESOURCE_NAME: "test-resource",
      AI_AZURE_API_KEY: "azure-api-key",
      AI_AZURE_API_VERSION: "v1",
    });

    expect(model).toEqual({ providerName: "azure", modelName: "gpt-4.1" });
    expect(mocks.createAzure).toHaveBeenCalledWith({
      apiKey: "azure-api-key",
      resourceName: "test-resource",
      apiVersion: "v1",
    });
  });

  test("reports a fully configured OpenAI-compatible instance with the base URL and model", () => {
    expect(
      getAiConfigurationStatus({
        AI_PROVIDER: "openai-compatible",
        AI_MODEL: "Qwen/Qwen2.5-7B-Instruct",
        AI_OPENAI_COMPATIBLE_BASE_URL: "http://vllm:8000/v1",
      })
    ).toEqual({
      provider: "openai-compatible",
      model: "Qwen/Qwen2.5-7B-Instruct",
      isConfigured: true,
      missingFields: [],
      invalidFields: [],
      providerStatus: {
        provider: "openai-compatible",
        model: "Qwen/Qwen2.5-7B-Instruct",
        isConfigured: true,
        missingFields: [],
        invalidFields: [],
      },
    });
  });

  test("treats the OpenAI-compatible instance as not configured when the base URL is missing", () => {
    expect(
      getAiConfigurationStatus({
        AI_PROVIDER: "openai-compatible",
        AI_MODEL: "Qwen/Qwen2.5-7B-Instruct",
      })
    ).toMatchObject({
      provider: "openai-compatible",
      model: "Qwen/Qwen2.5-7B-Instruct",
      isConfigured: false,
      missingFields: ["AI_OPENAI_COMPATIBLE_BASE_URL"],
      errorCode: "providerNotConfigured",
    });
  });

  test("treats the OpenAI-compatible instance as not configured when the model is missing", () => {
    expect(
      getAiConfigurationStatus({
        AI_PROVIDER: "openai-compatible",
        AI_OPENAI_COMPATIBLE_BASE_URL: "http://vllm:8000/v1",
      })
    ).toMatchObject({
      provider: "openai-compatible",
      model: null,
      isConfigured: false,
      missingFields: ["AI_MODEL"],
      errorCode: "providerNotConfigured",
    });
  });

  test("treats the OpenAI-compatible instance as not configured when the base URL is invalid", () => {
    expect(
      getAiConfigurationStatus({
        AI_PROVIDER: "openai-compatible",
        AI_MODEL: "Qwen/Qwen2.5-7B-Instruct",
        AI_OPENAI_COMPATIBLE_BASE_URL: "not-a-url",
      })
    ).toMatchObject({
      provider: "openai-compatible",
      isConfigured: false,
      invalidFields: ["AI_OPENAI_COMPATIBLE_BASE_URL"],
      errorCode: "providerNotConfigured",
    });
  });

  test("treats the OpenAI-compatible instance as not configured when the headers JSON is invalid", () => {
    expect(
      getAiConfigurationStatus({
        AI_PROVIDER: "openai-compatible",
        AI_MODEL: "Qwen/Qwen2.5-7B-Instruct",
        AI_OPENAI_COMPATIBLE_BASE_URL: "http://vllm:8000/v1",
        AI_OPENAI_COMPATIBLE_HEADERS_JSON: "{not-json}",
      })
    ).toMatchObject({
      provider: "openai-compatible",
      isConfigured: false,
      invalidFields: ["AI_OPENAI_COMPATIBLE_HEADERS_JSON"],
      errorCode: "providerNotConfigured",
    });
  });

  test("treats the OpenAI-compatible instance as not configured when the query params JSON is invalid", () => {
    expect(
      getAiConfigurationStatus({
        AI_PROVIDER: "openai-compatible",
        AI_MODEL: "Qwen/Qwen2.5-7B-Instruct",
        AI_OPENAI_COMPATIBLE_BASE_URL: "http://vllm:8000/v1",
        AI_OPENAI_COMPATIBLE_QUERY_PARAMS_JSON: "[]",
      })
    ).toMatchObject({
      provider: "openai-compatible",
      isConfigured: false,
      invalidFields: ["AI_OPENAI_COMPATIBLE_QUERY_PARAMS_JSON"],
      errorCode: "providerNotConfigured",
    });
  });

  test("creates and caches an OpenAI-compatible model with all provider-shaping fields", () => {
    const openaiCompatibleProvider = createMockProvider("openai-compatible");
    mocks.createOpenAICompatible.mockReturnValue(openaiCompatibleProvider);

    const environment: AIEnvironment = {
      AI_PROVIDER: "openai-compatible",
      AI_MODEL: "Qwen/Qwen2.5-7B-Instruct",
      AI_OPENAI_COMPATIBLE_BASE_URL: "http://vllm:8000/v1",
      AI_OPENAI_COMPATIBLE_API_KEY: "vllm-api-key",
      AI_OPENAI_COMPATIBLE_PROVIDER_NAME: "qwen-vllm",
      AI_OPENAI_COMPATIBLE_SUPPORTS_STRUCTURED_OUTPUTS: "true",
      AI_OPENAI_COMPATIBLE_HEADERS_JSON: JSON.stringify({ "X-Tenant": "acme" }),
      AI_OPENAI_COMPATIBLE_QUERY_PARAMS_JSON: JSON.stringify({ "api-version": "2024-01" }),
    };

    const firstModel = getAiModel(environment);
    const secondModel = getAiModel(environment);

    expect(firstModel).toEqual({ providerName: "openai-compatible", modelName: "Qwen/Qwen2.5-7B-Instruct" });
    expect(secondModel).toBe(firstModel);
    expect(mocks.createOpenAICompatible).toHaveBeenCalledWith({
      name: "qwen-vllm",
      baseURL: "http://vllm:8000/v1",
      supportsStructuredOutputs: true,
      apiKey: "vllm-api-key",
      headers: { "X-Tenant": "acme" },
      queryParams: { "api-version": "2024-01" },
    });
    expect(openaiCompatibleProvider).toHaveBeenCalledWith("Qwen/Qwen2.5-7B-Instruct");
    expect(mocks.createOpenAICompatible).toHaveBeenCalledTimes(1);
  });

  test("creates an OpenAI-compatible model without an API key and defaults the provider name", () => {
    const openaiCompatibleProvider = createMockProvider("openai-compatible");
    mocks.createOpenAICompatible.mockReturnValue(openaiCompatibleProvider);

    const model = getAiModel({
      AI_PROVIDER: "openai-compatible",
      AI_MODEL: "Qwen/Qwen2.5-7B-Instruct",
      AI_OPENAI_COMPATIBLE_BASE_URL: "http://vllm:8000/v1",
    });

    expect(model).toEqual({ providerName: "openai-compatible", modelName: "Qwen/Qwen2.5-7B-Instruct" });
    expect(mocks.createOpenAICompatible).toHaveBeenCalledWith({
      name: "openai-compatible",
      baseURL: "http://vllm:8000/v1",
      supportsStructuredOutputs: false,
    });
    expect(openaiCompatibleProvider).toHaveBeenCalledWith("Qwen/Qwen2.5-7B-Instruct");
  });

  test("does not reuse a cached OpenAI-compatible model after the base URL changes", () => {
    const firstProvider = createMockProvider("openai-compatible");
    const secondProvider = createMockProvider("openai-compatible");
    mocks.createOpenAICompatible.mockReturnValueOnce(firstProvider).mockReturnValueOnce(secondProvider);

    const firstModel = getAiModel({
      AI_PROVIDER: "openai-compatible",
      AI_MODEL: "Qwen/Qwen2.5-7B-Instruct",
      AI_OPENAI_COMPATIBLE_BASE_URL: "http://vllm-a:8000/v1",
    });
    const secondModel = getAiModel({
      AI_PROVIDER: "openai-compatible",
      AI_MODEL: "Qwen/Qwen2.5-7B-Instruct",
      AI_OPENAI_COMPATIBLE_BASE_URL: "http://vllm-b:8000/v1",
    });

    expect(secondModel).not.toBe(firstModel);
    expect(mocks.createOpenAICompatible).toHaveBeenCalledTimes(2);
  });

  test("throws a helpful error when the active model is missing", () => {
    const getModel = (): ReturnType<typeof getAiModel> =>
      getAiModel({
        AI_PROVIDER: "google",
        AI_GOOGLE_CLOUD_PROJECT: "test-project",
        AI_GOOGLE_CLOUD_LOCATION: "us-central1",
        AI_GOOGLE_CLOUD_APPLICATION_CREDENTIALS: "/tmp/google-cloud.json",
      });

    expect(getModel).toThrowError(AIConfigurationError);
    expect(getModel).toThrowError(/AI_MODEL/);
  });
});
