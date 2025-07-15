import { TPipelineInput } from "@/app/api/(internal)/pipeline/types/pipelines";
import { symmetricDecrypt } from "@/lib/crypto";
import { PlainClient } from "@team-plain/typescript-sdk";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { logger } from "@formbricks/logger";
import { err, ok } from "@formbricks/types/error-handlers";
import { TIntegrationPlainConfig, TIntegrationPlainConfigData } from "@formbricks/types/integration/plain";
import { writeData } from "./service";

// Mock dependencies before importing the module under test
vi.mock("@team-plain/typescript-sdk", () => {
  return {
    PlainClient: vi.fn(),
  };
});

vi.mock("@/lib/crypto", () => {
  return {
    symmetricDecrypt: vi.fn(),
  };
});

vi.mock("@formbricks/logger", () => {
  return {
    logger: {
      error: vi.fn(),
    },
  };
});

vi.mock("@/lib/constants", () => {
  return {
    ENCRYPTION_KEY: "test-encryption-key",
  };
});

describe("Plain Service", () => {
  // Mock data
  const mockConfig: TIntegrationPlainConfig = {
    key: "encrypted-api-key",
    data: [],
  };

  const mockIntegrationConfig: TIntegrationPlainConfigData = {
    surveyId: "survey-123",
    surveyName: "Test Survey",
    mapping: [
      {
        plainField: {
          id: "threadTitle",
          name: "Thread Title",
          type: "title" as const,
        },
        question: {
          id: "q1",
          name: "Question 1",
          type: "openText",
        },
      },
      {
        plainField: {
          id: "componentText",
          name: "Component Text",
          type: "componentText" as const,
        },
        question: {
          id: "q2",
          name: "Question 2",
          type: "openText",
        },
      },
      {
        plainField: {
          id: "labelTypeId",
          name: "Label Type",
          type: "labelTypeId" as const,
        },
        question: {
          id: "q3",
          name: "Question 3",
          type: "openText",
        },
      },
    ],
    includeCreatedAt: true,
    includeComponents: true,
    createdAt: new Date(),
  };

  const mockPipelineInput: TPipelineInput = {
    environmentId: "env-123",
    surveyId: "survey-123",
    event: "responseFinished",
    response: {
      id: "response-123",
      createdAt: new Date(),
      updatedAt: new Date(),
      surveyId: "survey-123",
      finished: true,
      data: {
        q1: "Test Thread Title",
        q2: "This is the component text content",
        q3: "label-456",
        contactInfo: ["John", "Doe", "john.doe@example.com"],
      },
      meta: { url: "https://example.com" },
      contact: null,
      contactAttributes: null,
      variables: {},
      notes: [],
      tags: [],
      singleUseId: null,
      language: null,
    },
  };

  // Mock implementations
  const mockUpsertCustomer = vi.fn().mockResolvedValue({});
  const mockCreateThread = vi.fn().mockResolvedValue({
    id: "thread-123",
    title: "Test Thread",
  });
  const mockPlainClientInstance = {
    upsertCustomer: mockUpsertCustomer,
    createThread: mockCreateThread,
  };

  // Setup before each test
  beforeEach(() => {
    vi.clearAllMocks();

    // Setup PlainClient mock
    vi.mocked(PlainClient).mockImplementation(() => mockPlainClientInstance as unknown as PlainClient);

    // Setup symmetricDecrypt mock
    vi.mocked(symmetricDecrypt).mockReturnValue("decrypted-api-key");
  });

  test("successfully sends data to Plain", async () => {
    // Act
    const result = await writeData(mockConfig, mockPipelineInput, mockIntegrationConfig);

    // Assert
    expect(symmetricDecrypt).toHaveBeenCalledWith("encrypted-api-key", "test-encryption-key");
    expect(PlainClient).toHaveBeenCalledWith({ apiKey: "decrypted-api-key" });

    // Verify customer creation
    expect(mockUpsertCustomer).toHaveBeenCalledWith({
      identifier: {
        emailAddress: "john.doe@example.com",
      },
      onCreate: {
        fullName: "John Doe",
        email: {
          email: "john.doe@example.com",
          isVerified: false,
        },
      },
      onUpdate: {
        fullName: {
          value: "John Doe",
        },
      },
    });

    // Verify thread creation
    expect(mockCreateThread).toHaveBeenCalledWith({
      title: "Test Thread Title",
      customerIdentifier: {
        emailAddress: "john.doe@example.com",
      },
      components: [
        {
          componentText: {
            text: "This is the component text content",
          },
        },
      ],
      labelTypeIds: ["label-456"],
    });

    expect(result).toEqual(ok(undefined));
  });

  test("returns error when title is missing", async () => {
    // Arrange
    const inputWithoutTitle: TPipelineInput = {
      ...mockPipelineInput,
      response: {
        ...mockPipelineInput.response,
        data: {
          // No q1 (title) field
          q2: "This is the component text content",
          q3: "label-456",
          contactInfo: ["John", "Doe", "john.doe@example.com"],
        },
      },
    };

    // Act
    const result = await writeData(mockConfig, inputWithoutTitle, mockIntegrationConfig);

    // Assert
    expect(result).toEqual(err(new Error("Missing title in response data.")));
    expect(mockUpsertCustomer).not.toHaveBeenCalled();
    expect(mockCreateThread).not.toHaveBeenCalled();
  });

  test("returns error when component text is missing", async () => {
    // Arrange
    const inputWithoutComponentText: TPipelineInput = {
      ...mockPipelineInput,
      response: {
        ...mockPipelineInput.response,
        data: {
          q1: "Test Thread Title",
          // No q2 (component text) field
          q3: "label-456",
          contactInfo: ["John", "Doe", "john.doe@example.com"],
        },
      },
    };

    // Act
    const result = await writeData(mockConfig, inputWithoutComponentText, mockIntegrationConfig);

    // Assert
    expect(result).toEqual(err(new Error("Missing component text in response data.")));
    expect(mockUpsertCustomer).not.toHaveBeenCalled();
    expect(mockCreateThread).not.toHaveBeenCalled();
  });

  test("creates thread without label when labelId is not mapped", async () => {
    // Arrange
    const configWithoutLabel: TIntegrationPlainConfigData = {
      ...mockIntegrationConfig,
      mapping: mockIntegrationConfig.mapping.filter((m) => m.plainField.id !== "labelTypeId"),
    };

    // Act
    const result = await writeData(mockConfig, mockPipelineInput, configWithoutLabel);

    // Assert
    expect(mockCreateThread).toHaveBeenCalledWith(
      expect.not.objectContaining({
        labelTypeIds: expect.anything(),
      })
    );
    expect(result).toEqual(ok(undefined));
  });

  test("handles API errors gracefully", async () => {
    // Arrange
    const apiError = new Error("API Error");
    mockUpsertCustomer.mockRejectedValueOnce(apiError);

    // Act
    const result = await writeData(mockConfig, mockPipelineInput, mockIntegrationConfig);

    // Assert
    expect(logger.error).toHaveBeenCalledWith("Exception in Plain writeData function", {
      error: apiError,
    });
    expect(result).toEqual(err(apiError));
  });

  test("handles decryption errors", async () => {
    // Arrange
    const decryptionError = new Error("Decryption failed");
    vi.mocked(symmetricDecrypt).mockImplementationOnce(() => {
      throw decryptionError;
    });

    // Act
    const result = await writeData(mockConfig, mockPipelineInput, mockIntegrationConfig);

    // Assert
    expect(logger.error).toHaveBeenCalledWith("Exception in Plain writeData function", {
      error: decryptionError,
    });
    expect(result).toEqual(err(decryptionError));
  });
});
