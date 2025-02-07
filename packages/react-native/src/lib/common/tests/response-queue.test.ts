// response-queue.test.ts
import { beforeEach, describe, expect, test, vi } from "vitest";
import { type FormbricksAPI } from "@formbricks/api";
import {
  mockAppUrl,
  mockDisplayId,
  mockEnvironmentId,
  mockQuestionId,
  mockResponseId,
  mockSurveyId,
  mockUserId,
} from "./__mocks__/response-queue.mock";
import { ResponseQueue } from "@/lib/common/response-queue";
import type { SurveyState } from "@/lib/survey/state";
import type { TResponseUpdate } from "@/types/response";

describe("ResponseQueue", () => {
  let responseQueue: ResponseQueue;
  let mockSurveyState: Partial<SurveyState>;
  let mockConfig: {
    appUrl: string;
    environmentId: string;
    retryAttempts: number;
    onResponseSendingFailed?: (resp: TResponseUpdate) => void;
    onResponseSendingFinished?: () => void;
    setSurveyState?: (state: SurveyState) => void;
  };
  let mockApi: FormbricksAPI;

  beforeEach(() => {
    vi.clearAllMocks();

    // 2) Setup a "fake" surveyState
    mockSurveyState = {
      responseId: null,
      surveyId: mockSurveyId,
      userId: mockUserId,
      singleUseId: null,
      displayId: mockDisplayId,
      accumulateResponse: vi.fn(),
      updateResponseId: vi.fn(),
    };

    // 3) Setup a config object
    mockConfig = {
      appUrl: mockAppUrl,
      environmentId: mockEnvironmentId,
      retryAttempts: 2,
      onResponseSendingFailed: vi.fn(),
      onResponseSendingFinished: vi.fn(),
      setSurveyState: vi.fn(),
    };

    // Create the queue
    mockApi = {
      client: {
        response: {
          create: vi.fn(),
          update: vi.fn(),
        },
      },
    } as unknown as FormbricksAPI;

    responseQueue = new ResponseQueue(mockConfig, mockSurveyState as SurveyState, mockApi);
  });

  test("add() accumulates response, updates setSurveyState, and calls processQueue()", () => {
    // Spy on processQueue
    const processQueueMock = vi.spyOn(responseQueue, "processQueue");

    const update: TResponseUpdate = {
      data: {
        [mockQuestionId]: "test",
      },
      ttc: {
        [mockQuestionId]: 1000,
      },
      finished: false,
    };

    // Call queue.add
    responseQueue.add(update);

    expect(mockSurveyState.accumulateResponse).toHaveBeenCalledWith(update);
    expect(mockConfig.setSurveyState).toHaveBeenCalledTimes(1);
    expect(processQueueMock).toHaveBeenCalledTimes(1);
  });

  test("processQueue does nothing if already in progress or queue is empty", async () => {
    // Because processQueue is called in add()
    // Let's set isRequestInProgress artificially and call processQueue directly:
    const responseQueueWithIsRequestInProgress = responseQueue as unknown as {
      isRequestInProgress: boolean;
    };
    responseQueueWithIsRequestInProgress.isRequestInProgress = true;
    await responseQueue.processQueue();

    // No changes, no error
    expect(responseQueueWithIsRequestInProgress.isRequestInProgress).toBe(true);

    // Now set queue empty, isRequestInProgress false
    responseQueueWithIsRequestInProgress.isRequestInProgress = false;
    await responseQueue.processQueue();
    // still no error, but no action
    // This just ensures we handle those conditions gracefully
  });

  test("when surveyState has no responseId, it calls create(...) and sets responseId on success", async () => {
    const formbricksApiMock = vi.spyOn(mockApi.client.response, "create");

    formbricksApiMock.mockResolvedValueOnce({
      ok: true,
      data: { id: mockResponseId },
    });

    // Add an item
    const update: TResponseUpdate = {
      data: { [mockQuestionId]: "test" },
      ttc: { [mockQuestionId]: 1000 },
      finished: false,
    };

    responseQueue.add(update);

    // We need to wait for the queue to process
    await responseQueue.processQueue();

    // fake delay for the queue to process and get empty
    await new Promise((r) => {
      setTimeout(r, 100);
    });

    // Check create call
    expect(formbricksApiMock).toHaveBeenCalledWith({
      ...update,
      surveyId: mockSurveyId,
      userId: mockUserId,
      singleUseId: null,
      displayId: mockDisplayId,
      data: {
        [mockQuestionId]: "test",
      },
    });

    // responseId is updated
    expect(mockSurveyState.updateResponseId).toHaveBeenCalledWith(mockResponseId);

    const responseQueueWithQueueArr = responseQueue as unknown as { queue: TResponseUpdate[] };
    expect(responseQueueWithQueueArr.queue).toHaveLength(0);
  });

  test("when surveyState has a responseId, it calls update(...) and empties the queue", async () => {
    mockSurveyState.responseId = mockResponseId;

    const formbricksApiMock = vi.spyOn(mockApi.client.response, "update");

    // Mock update => success
    formbricksApiMock.mockResolvedValueOnce({
      ok: true,
      data: { id: mockResponseId },
    });

    const update: TResponseUpdate = {
      data: { [mockQuestionId]: "test" },
      ttc: { [mockQuestionId]: 1000 },
      finished: false,
    };

    responseQueue.add(update);

    await responseQueue.processQueue();

    // fake delay for the queue to process and get empty
    await new Promise((r) => {
      setTimeout(r, 100);
    });

    expect(formbricksApiMock).toHaveBeenCalledWith({
      ...update,
      responseId: mockResponseId,
    });

    const responseQueueWithQueueArr = responseQueue as unknown as { queue: TResponseUpdate[] };
    expect(responseQueueWithQueueArr.queue).toHaveLength(0);
  });

  test("retries up to retryAttempts if sendResponse fails", async () => {
    // Force create to fail
    const formbricksApiMock = vi.spyOn(mockApi.client.response, "create");
    formbricksApiMock.mockRejectedValueOnce(new Error("Network error"));

    const update: TResponseUpdate = {
      data: { [mockQuestionId]: "fail" },
      ttc: { [mockQuestionId]: 0 },
      finished: false,
    };

    responseQueue.add(update);

    await new Promise((r) => {
      setTimeout(r, 1000);
    });

    await responseQueue.processQueue();

    await new Promise((r) => {
      setTimeout(r, 1000);
    });

    // It tries 2 times
    expect(formbricksApiMock).toHaveBeenCalledTimes(2);
    // Ultimately fails => item remains in queue
    const responseQueueWithQueueArr = responseQueue as unknown as { queue: TResponseUpdate[] };
    expect(responseQueueWithQueueArr.queue).toHaveLength(1);
  });

  test("updateSurveyState updates the surveyState reference", () => {
    const newState = { responseId: mockResponseId } as SurveyState;
    responseQueue.updateSurveyState(newState);

    const responseQueueWithSurveyState = responseQueue as unknown as { surveyState: SurveyState };
    expect(responseQueueWithSurveyState.surveyState).toBe(newState);
  });
});
