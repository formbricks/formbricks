import { TPipelineInput } from "@/app/lib/types/pipelines";
import { symmetricDecrypt } from "@/lib/crypto";
import * as PlainSDK from "@team-plain/typescript-sdk";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { logger } from "@formbricks/logger";
import { err, ok } from "@formbricks/types/error-handlers";
import { TIntegrationPlainConfig, TIntegrationPlainConfigData } from "@formbricks/types/integration/plain";
import { writeData } from "./service";

// Mock dependencies
vi.mock("@/lib/crypto", () => ({
  symmetricDecrypt: vi.fn().mockReturnValue("decrypted-api-key"),
}));

// Create mock functions for PlainClient methods
const mockUpsertCustomer = vi.fn().mockResolvedValue({});
const mockCreateThread = vi.fn().mockResolvedValue({
  id: "thread-123",
  title: "Test Thread",
});

// Mock the PlainClient class
vi.mock("@team-plain/typescript-sdk", () => {
  return {
    PlainClient: vi.fn().mockImplementation(() => {
      return {
        upsertCustomer: mockUpsertCustomer,
        createThread: mockCreateThread,
      };
    }),
  };
});

vi.mock("@prisma/client", () => ({
  PipelineTriggers: {
    responseFinished: "responseFinished",
    responseCreated: "responseCreated",
    responseUpdated: "responseUpdated",
  },
}));

vi.mock("@formbricks/logger", () => ({
  logger: {
    error: vi.fn(),
  },
}));

vi.mock("@/lib/constants", () => ({
  ENCRYPTION_KEY: "test-encryption-key",
}));

describe("Plain Service", () => {
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
          type: "title",
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
          type: "componentText",
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
          type: "labelTypeId",
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

  const mockPipelineInputWithContactArray: TPipelineInput = {
    ...mockPipelineInput,
    response: {
      ...mockPipelineInput.response,
      data: {
        ...mockPipelineInput.response.data,
        contactArray: ["Jane", "Smith", "jane.smith@example.com"],
      },
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("successfully sends data to Plain", async () => {
    // Act
    const result = await writeData(mockConfig, mockPipelineInput, mockIntegrationConfig);

    // Assert
    expect(symmetricDecrypt).toHaveBeenCalledWith(mockConfig.key, "test-encryption-key");
    expect(PlainSDK.PlainClient).toHaveBeenCalledWith({ apiKey: "decrypted-api-key" });

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

  test("successfully sends data to Plain with contact info from array", async () => {
    // Act
    const result = await writeData(mockConfig, mockPipelineInputWithContactArray, mockIntegrationConfig);

    // Assert
    expect(mockUpsertCustomer).toHaveBeenCalledWith(
      expect.objectContaining({
        identifier: {
          emailAddress: "jane.smith@example.com",
        },
        onCreate: {
          fullName: "Jane Smith",
          email: {
            email: "jane.smith@example.com",
            isVerified: false,
          },
        },
      })
    );

    expect(result).toEqual(ok(undefined));
  });

  test("returns error when title is missing", async () => {
    // Arrange
    const inputWithoutTitle: TPipelineInput = {
      ...mockPipelineInput,
      response: {
        ...mockPipelineInput.response,
        data: {
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
    expect(PlainSDK.PlainClient).toHaveBeenCalledWith({ apiKey: "decrypted-api-key" });
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
          q3: "label-456",
          contactInfo: ["John", "Doe", "john.doe@example.com"],
        },
      },
    };

    // Act
    const result = await writeData(mockConfig, inputWithoutComponentText, mockIntegrationConfig);

    // Assert
    expect(result).toEqual(err(new Error("Missing component text in response data.")));
    expect(PlainSDK.PlainClient).toHaveBeenCalledWith({ apiKey: "decrypted-api-key" });
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
    const error = new Error("API Error");
    mockUpsertCustomer.mockRejectedValueOnce(error);

    // Act
    const result = await writeData(mockConfig, mockPipelineInput, mockIntegrationConfig);

    // Assert
    expect(logger.error).toHaveBeenCalledWith("Exception in Plain writeData function", { error });
    expect(result).toEqual(err(error));
  });

  test("handles non-Error exceptions gracefully", async () => {
    // Arrange
    const nonErrorException = "String exception";
    mockUpsertCustomer.mockRejectedValueOnce(nonErrorException);

    // Act
    const result = await writeData(mockConfig, mockPipelineInput, mockIntegrationConfig);

    // Assert
    expect(logger.error).toHaveBeenCalledWith("Exception in Plain writeData function", {
      error: nonErrorException,
    });
    expect(result).toEqual(err(new Error(String(nonErrorException))));
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
