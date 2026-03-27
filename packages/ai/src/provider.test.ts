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
        ACTIVE_AI_PROVIDER: " gcp ",
      })
    ).toBe("gcp");
  });

  test("resolves the active model from the environment", () => {
    expect(
      getActiveAiModel({
        ACTIVE_AI_MODEL: " gemini-2.5-flash ",
      })
    ).toBe("gemini-2.5-flash");
  });

  test("reports a fully configured GCP instance when the active provider credentials and model are valid", () => {
    expect(
      getAiConfigurationStatus({
        ACTIVE_AI_PROVIDER: "gcp",
        ACTIVE_AI_MODEL: "gemini-2.5-flash",
        GOOGLE_VERTEX_PROJECT: "test-project",
        GOOGLE_VERTEX_LOCATION: "us-central1",
        GOOGLE_VERTEX_CREDENTIALS_JSON: JSON.stringify({ client_email: "vertex@example.com" }),
      })
    ).toEqual({
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
  });

  test("treats the instance as not configured when ACTIVE_AI_PROVIDER is missing", () => {
    expect(
      isAiConfigured({
        ACTIVE_AI_MODEL: "gemini-2.5-flash",
        GOOGLE_VERTEX_PROJECT: "test-project",
        GOOGLE_VERTEX_LOCATION: "us-central1",
        GOOGLE_APPLICATION_CREDENTIALS: "/tmp/vertex.json",
      })
    ).toBe(false);
  });

  test("treats the instance as not configured when ACTIVE_AI_PROVIDER is unsupported", () => {
    expect(
      getAiConfigurationStatus({
        ACTIVE_AI_PROVIDER: "openai",
      })
    ).toMatchObject({
      provider: null,
      model: null,
      isConfigured: false,
      invalidFields: ["ACTIVE_AI_PROVIDER"],
      errorCode: "invalidProvider",
    });
  });

  test("treats the instance as not configured when the active model is missing", () => {
    expect(
      getAiConfigurationStatus({
        ACTIVE_AI_PROVIDER: "aws",
        AWS_REGION: "us-east-1",
        AWS_ACCESS_KEY_ID: "aws-access-key-id",
        AWS_SECRET_ACCESS_KEY: "aws-secret-access-key",
      })
    ).toMatchObject({
      provider: "aws",
      model: null,
      isConfigured: false,
      missingFields: ["ACTIVE_AI_MODEL"],
      errorCode: "providerNotConfigured",
    });
  });

  test("treats the instance as not configured when the selected provider is missing credentials", () => {
    expect(
      getAiConfigurationStatus({
        ACTIVE_AI_PROVIDER: "azure",
        ACTIVE_AI_MODEL: "gpt-4.1",
        AZURE_RESOURCE_NAME: "test-resource",
      })
    ).toMatchObject({
      provider: "azure",
      model: "gpt-4.1",
      isConfigured: false,
      missingFields: ["AZURE_API_KEY"],
      errorCode: "providerNotConfigured",
    });
  });

  test("treats the instance as not configured when GCP credentials JSON is invalid", () => {
    expect(
      getAiConfigurationStatus({
        ACTIVE_AI_PROVIDER: "gcp",
        ACTIVE_AI_MODEL: "gemini-2.5-flash",
        GOOGLE_VERTEX_PROJECT: "test-project",
        GOOGLE_VERTEX_LOCATION: "us-central1",
        GOOGLE_VERTEX_CREDENTIALS_JSON: "{not-json}",
      })
    ).toMatchObject({
      provider: "gcp",
      model: "gemini-2.5-flash",
      isConfigured: false,
      invalidFields: ["GOOGLE_VERTEX_CREDENTIALS_JSON"],
      errorCode: "providerNotConfigured",
    });
  });

  test("creates and caches a GCP model with parsed JSON credentials", () => {
    const vertexProvider = createMockProvider("gcp");
    mocks.createVertex.mockReturnValue(vertexProvider);

    const environment: AIEnvironment = {
      ACTIVE_AI_PROVIDER: "gcp",
      ACTIVE_AI_MODEL: "gemini-2.5-flash",
      GOOGLE_VERTEX_PROJECT: "test-project",
      GOOGLE_VERTEX_LOCATION: "us-central1",
      GOOGLE_VERTEX_CREDENTIALS_JSON: JSON.stringify({ client_email: "vertex@example.com" }),
    };

    const firstModel = getAiModel(environment);
    const secondModel = getAiModel(environment);

    expect(firstModel).toEqual({ providerName: "gcp", modelName: "gemini-2.5-flash" });
    expect(secondModel).toBe(firstModel);
    expect(mocks.createVertex).toHaveBeenCalledWith({
      project: "test-project",
      location: "us-central1",
      googleAuthOptions: {
        credentials: {
          client_email: "vertex@example.com",
        },
      },
    });
    expect(vertexProvider).toHaveBeenCalledWith("gemini-2.5-flash");
    expect(mocks.createVertex).toHaveBeenCalledTimes(1);
  });

  test("creates an AWS model with explicit AWS credentials", () => {
    const bedrockProvider = createMockProvider("aws");
    mocks.createAmazonBedrock.mockReturnValue(bedrockProvider);

    const model = getAiModel({
      ACTIVE_AI_PROVIDER: "aws",
      ACTIVE_AI_MODEL: "amazon.nova-lite-v1:0",
      AWS_REGION: "us-east-1",
      AWS_ACCESS_KEY_ID: "aws-access-key-id",
      AWS_SECRET_ACCESS_KEY: "aws-secret-access-key",
      AWS_SESSION_TOKEN: "aws-session-token",
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
      ACTIVE_AI_PROVIDER: "azure",
      ACTIVE_AI_MODEL: "gpt-4.1",
      AZURE_RESOURCE_NAME: "test-resource",
      AZURE_API_KEY: "azure-api-key",
      AZURE_API_VERSION: "v1",
    });

    expect(model).toEqual({ providerName: "azure", modelName: "gpt-4.1" });
    expect(mocks.createAzure).toHaveBeenCalledWith({
      apiKey: "azure-api-key",
      resourceName: "test-resource",
      apiVersion: "v1",
    });
  });

  test("throws a helpful error when the active model is missing", () => {
    try {
      getAiModel({
        ACTIVE_AI_PROVIDER: "gcp",
        GOOGLE_VERTEX_PROJECT: "test-project",
        GOOGLE_VERTEX_LOCATION: "us-central1",
        GOOGLE_APPLICATION_CREDENTIALS: "/tmp/vertex.json",
      });
      throw new Error("Expected getAiModel to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(AIConfigurationError);

      if (!(error instanceof AIConfigurationError)) {
        throw error;
      }

      expect(error.code).toBe("providerNotConfigured");
    }
  });
});
