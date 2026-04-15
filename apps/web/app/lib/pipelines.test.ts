import { beforeEach, describe, expect, test, vi } from "vitest";
import type { TResponse } from "@formbricks/types/responses";
import { enqueueResponsePipelineEvents, scheduleResponsePipelineEvents } from "./pipelines";

const {
  mockAfter,
  mockDebug,
  mockEnqueueResponsePipeline,
  mockError,
  mockGetJobsQueueingConfig,
  mockGetResponseSnapshotForPipeline,
  mockWarn,
} = vi.hoisted(() => ({
  mockAfter: vi.fn(),
  mockDebug: vi.fn(),
  mockEnqueueResponsePipeline: vi.fn(),
  mockError: vi.fn(),
  mockGetJobsQueueingConfig: vi.fn(),
  mockGetResponseSnapshotForPipeline: vi.fn(),
  mockWarn: vi.fn(),
}));

vi.mock("next/server", () => ({
  after: mockAfter,
}));

vi.mock("@formbricks/jobs", () => ({
  getBackgroundJobProducer: () => ({
    enqueueResponsePipeline: mockEnqueueResponsePipeline,
  }),
}));

vi.mock("@/lib/jobs/config", () => ({
  getJobsQueueingConfig: mockGetJobsQueueingConfig,
}));

vi.mock("@/lib/response/service", () => ({
  getResponseSnapshotForPipeline: mockGetResponseSnapshotForPipeline,
}));

vi.mock("@formbricks/logger", () => ({
  logger: {
    debug: mockDebug,
    error: mockError,
    info: vi.fn(),
    warn: mockWarn,
  },
}));

const mockResponse = {
  contact: null,
  contactAttributes: null,
  createdAt: new Date("2026-04-08T10:00:00.000Z"),
  data: {},
  displayId: null,
  endingId: null,
  finished: false,
  id: "cm9-response-id",
  language: null,
  meta: {},
  singleUseId: null,
  surveyId: "cm9-survey-id",
  tags: [],
  updatedAt: new Date("2026-04-08T10:00:00.000Z"),
  variables: {},
} satisfies TResponse;

describe("enqueueResponsePipelineEvents", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  test("skips enqueueing when jobs queueing is disabled", async () => {
    mockGetJobsQueueingConfig.mockReturnValue({
      enabled: false,
      redisUrl: null,
    });

    await enqueueResponsePipelineEvents({
      environmentId: "env_123",
      events: ["responseCreated"],
      responseId: "cm9-response-id",
      surveyId: "cm9-survey-id",
    });

    expect(mockGetResponseSnapshotForPipeline).not.toHaveBeenCalled();
    expect(mockEnqueueResponsePipeline).not.toHaveBeenCalled();
    expect(mockDebug).toHaveBeenCalledWith(
      {
        environmentId: "env_123",
        events: ["responseCreated"],
        responseId: "cm9-response-id",
        surveyId: "cm9-survey-id",
      },
      "BullMQ response pipeline enqueue skipped"
    );
  });

  test("throws when the response snapshot lookup still fails after retries", async () => {
    vi.useFakeTimers();

    const snapshotError = new Error("db down");
    mockGetJobsQueueingConfig.mockReturnValue({
      enabled: true,
      redisUrl: "redis://localhost:6379",
    });
    mockGetResponseSnapshotForPipeline.mockRejectedValue(snapshotError);

    const enqueueExpectation = expect(
      enqueueResponsePipelineEvents({
        environmentId: "env_123",
        events: ["responseCreated"],
        responseId: "cm9-response-id",
        surveyId: "cm9-survey-id",
      })
    ).rejects.toThrow("db down");

    await vi.runAllTimersAsync();

    await enqueueExpectation;
    expect(mockGetResponseSnapshotForPipeline).toHaveBeenCalledTimes(3);
    expect(mockError).toHaveBeenCalledWith(
      {
        environmentId: "env_123",
        err: snapshotError,
        events: ["responseCreated"],
        responseId: "cm9-response-id",
        surveyId: "cm9-survey-id",
      },
      "Failed to hydrate response snapshot for BullMQ response pipeline"
    );
  });

  test("uses the provided response snapshot without loading it again", async () => {
    mockGetJobsQueueingConfig.mockReturnValue({
      enabled: true,
      redisUrl: "redis://localhost:6379",
    });
    mockEnqueueResponsePipeline.mockResolvedValue({ jobId: "job-1" });

    await enqueueResponsePipelineEvents({
      environmentId: "env_123",
      events: ["responseCreated"],
      response: mockResponse,
      responseId: mockResponse.id,
      surveyId: mockResponse.surveyId,
    });

    expect(mockGetResponseSnapshotForPipeline).not.toHaveBeenCalled();
    expect(mockEnqueueResponsePipeline).toHaveBeenCalledWith({
      environmentId: "env_123",
      event: "responseCreated",
      response: mockResponse,
      surveyId: "cm9-survey-id",
    });
  });

  test("falls back to an uncached snapshot lookup when the provided response id mismatches", async () => {
    mockGetJobsQueueingConfig.mockReturnValue({
      enabled: true,
      redisUrl: "redis://localhost:6379",
    });
    mockGetResponseSnapshotForPipeline.mockResolvedValue(mockResponse);
    mockEnqueueResponsePipeline.mockResolvedValue({ jobId: "job-1" });

    await enqueueResponsePipelineEvents({
      environmentId: "env_123",
      events: ["responseCreated"],
      response: {
        ...mockResponse,
        id: "other-response-id",
      },
      responseId: mockResponse.id,
      surveyId: mockResponse.surveyId,
    });

    expect(mockWarn).toHaveBeenCalledWith(
      {
        environmentId: "env_123",
        events: ["responseCreated"],
        providedResponseId: "other-response-id",
        responseId: mockResponse.id,
        surveyId: "cm9-survey-id",
      },
      "BullMQ response pipeline enqueue ignored a mismatched provided response snapshot"
    );
    expect(mockGetResponseSnapshotForPipeline).toHaveBeenCalledWith(mockResponse.id);
    expect(mockEnqueueResponsePipeline).toHaveBeenCalledWith({
      environmentId: "env_123",
      event: "responseCreated",
      response: mockResponse,
      surveyId: "cm9-survey-id",
    });
  });

  test("hydrates one response snapshot and enqueues unique events", async () => {
    mockGetJobsQueueingConfig.mockReturnValue({
      enabled: true,
      redisUrl: "redis://localhost:6379",
    });
    mockGetResponseSnapshotForPipeline.mockResolvedValue(mockResponse);
    mockEnqueueResponsePipeline
      .mockResolvedValueOnce({ jobId: "job-1" })
      .mockResolvedValueOnce({ jobId: "job-2" });

    await enqueueResponsePipelineEvents({
      environmentId: "env_123",
      events: ["responseCreated", "responseFinished", "responseFinished"],
      responseId: "cm9-response-id",
      surveyId: "cm9-survey-id",
    });

    expect(mockGetResponseSnapshotForPipeline).toHaveBeenCalledTimes(1);
    expect(mockEnqueueResponsePipeline).toHaveBeenCalledTimes(2);
    expect(mockEnqueueResponsePipeline).toHaveBeenNthCalledWith(1, {
      environmentId: "env_123",
      event: "responseCreated",
      response: mockResponse,
      surveyId: "cm9-survey-id",
    });
    expect(mockEnqueueResponsePipeline).toHaveBeenNthCalledWith(2, {
      environmentId: "env_123",
      event: "responseFinished",
      response: mockResponse,
      surveyId: "cm9-survey-id",
    });
  });

  test("throws when enqueueing still fails after retries", async () => {
    vi.useFakeTimers();

    const enqueueError = new Error("redis unavailable");
    mockGetJobsQueueingConfig.mockReturnValue({
      enabled: true,
      redisUrl: "redis://localhost:6379",
    });
    mockGetResponseSnapshotForPipeline.mockResolvedValue(mockResponse);
    mockEnqueueResponsePipeline.mockRejectedValue(enqueueError);

    const enqueueExpectation = expect(
      enqueueResponsePipelineEvents({
        environmentId: "env_123",
        events: ["responseFinished"],
        responseId: "cm9-response-id",
        surveyId: "cm9-survey-id",
      })
    ).rejects.toThrow("Failed to enqueue BullMQ response pipeline events: responseFinished");

    await vi.runAllTimersAsync();

    await enqueueExpectation;
    expect(mockEnqueueResponsePipeline).toHaveBeenCalledTimes(4);
    expect(mockError).toHaveBeenCalledWith(
      {
        environmentId: "env_123",
        err: enqueueError,
        event: "responseFinished",
        responseId: "cm9-response-id",
        surveyId: "cm9-survey-id",
      },
      "Failed to enqueue BullMQ response pipeline job"
    );
  });
});

describe("scheduleResponsePipelineEvents", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("defers the BullMQ enqueue work until after the response is sent", async () => {
    let scheduledCallback: (() => Promise<void>) | undefined;

    mockAfter.mockImplementation((callback: () => Promise<void>) => {
      scheduledCallback = callback;
    });
    mockGetJobsQueueingConfig.mockReturnValue({
      enabled: true,
      redisUrl: "redis://localhost:6379",
    });
    mockEnqueueResponsePipeline.mockResolvedValue({ jobId: "job-1" });

    scheduleResponsePipelineEvents({
      environmentId: "env_123",
      events: ["responseCreated"],
      response: mockResponse,
      responseId: mockResponse.id,
      surveyId: mockResponse.surveyId,
    });

    expect(mockAfter).toHaveBeenCalledTimes(1);
    expect(mockEnqueueResponsePipeline).not.toHaveBeenCalled();

    await scheduledCallback?.();

    expect(mockEnqueueResponsePipeline).toHaveBeenCalledWith({
      environmentId: "env_123",
      event: "responseCreated",
      response: mockResponse,
      surveyId: "cm9-survey-id",
    });
  });
});
