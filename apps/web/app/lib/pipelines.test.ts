import { TPipelineInput } from "@/app/lib/types/pipelines";
import { PipelineTriggers } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { logger } from "@formbricks/logger";
import { TResponse } from "@formbricks/types/responses";
import { sendToPipeline } from "./pipelines";

// Mock the constants module
vi.mock("@formbricks/lib/constants", () => ({
  CRON_SECRET: "mocked-cron-secret",
  WEBAPP_URL: "https://test.formbricks.com",
}));

// Mock the logger
vi.mock("@formbricks/logger", () => ({
  logger: {
    error: vi.fn(),
  },
}));

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("pipelines", () => {
  // Reset mocks before each test
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Clean up after each test
  afterEach(() => {
    vi.clearAllMocks();
  });

  test("sendToPipeline should call fetch with correct parameters", async () => {
    // Mock the fetch implementation to return a successful response
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true }),
    });

    // Create sample data for testing
    const testData: TPipelineInput = {
      event: PipelineTriggers.responseCreated,
      surveyId: "cm8ckvchx000008lb710n0gdn",
      environmentId: "cm8cmp9hp000008jf7l570ml2",
      response: { id: "cm8cmpnjj000108jfdr9dfqe6" } as TResponse,
    };

    // Call the function with test data
    await sendToPipeline(testData);

    // Check that fetch was called with the correct arguments
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith("https://test.formbricks.com/api/pipeline", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": "mocked-cron-secret",
      },
      body: JSON.stringify({
        environmentId: testData.environmentId,
        surveyId: testData.surveyId,
        event: testData.event,
        response: testData.response,
      }),
    });
  });

  test("sendToPipeline should handle fetch errors", async () => {
    // Mock fetch to throw an error
    const testError = new Error("Network error");
    mockFetch.mockRejectedValueOnce(testError);

    // Create sample data for testing
    const testData: TPipelineInput = {
      event: PipelineTriggers.responseCreated,
      surveyId: "cm8ckvchx000008lb710n0gdn",
      environmentId: "cm8cmp9hp000008jf7l570ml2",
      response: { id: "cm8cmpnjj000108jfdr9dfqe6" } as TResponse,
    };

    // Call the function
    await sendToPipeline(testData);

    // Check that the error was logged using logger
    expect(logger.error).toHaveBeenCalledWith(testError, "Error sending event to pipeline");
  });

  test("sendToPipeline should throw error if CRON_SECRET is not set", async () => {
    // For this test, we need to mock CRON_SECRET as undefined
    // Let's use a more compatible approach to reset the mocks
    const originalModule = await import("@formbricks/lib/constants");
    const mockConstants = { ...originalModule, CRON_SECRET: undefined };

    vi.doMock("@formbricks/lib/constants", () => mockConstants);

    // Re-import the module to get the new mocked values
    const { sendToPipeline: sendToPipelineNoSecret } = await import("./pipelines");

    // Create sample data for testing
    const testData: TPipelineInput = {
      event: PipelineTriggers.responseCreated,
      surveyId: "cm8ckvchx000008lb710n0gdn",
      environmentId: "cm8cmp9hp000008jf7l570ml2",
      response: { id: "cm8cmpnjj000108jfdr9dfqe6" } as TResponse,
    };

    // Expect the function to throw an error
    await expect(sendToPipelineNoSecret(testData)).rejects.toThrow("CRON_SECRET is not set");
  });
});
