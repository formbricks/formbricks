import { beforeEach, describe, expect, test, vi } from "vitest";
import type { TResponse } from "@formbricks/types/responses";
import { enqueueResponsePipelineEvents } from "./pipelines";

const {
  mockDebug,
  mockEnqueueResponsePipeline,
  mockError,
  mockGetJobsQueueingConfig,
  mockGetResponseSnapshotForPipeline,
  mockWarn,
} = vi.hoisted(() => ({
  mockDebug: vi.fn(),
  mockEnqueueResponsePipeline: vi.fn(),
  mockError: vi.fn(),
  mockGetJobsQueueingConfig: vi.fn(),
  mockGetResponseSnapshotForPipeline: vi.fn(),
  mockWarn: vi.fn(),
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

  test("logs and skips when the response snapshot lookup throws", async () => {
    const snapshotError = new Error("db down");
    mockGetJobsQueueingConfig.mockReturnValue({
      enabled: true,
      redisUrl: "redis://localhost:6379",
    });
    mockGetResponseSnapshotForPipeline.mockRejectedValue(snapshotError);

    await enqueueResponsePipelineEvents({
      environmentId: "env_123",
      events: ["responseCreated"],
      responseId: "cm9-response-id",
      surveyId: "cm9-survey-id",
    });

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
    expect(mockEnqueueResponsePipeline).not.toHaveBeenCalled();
  });

  test("logs and skips when the response snapshot is missing", async () => {
    mockGetJobsQueueingConfig.mockReturnValue({
      enabled: true,
      redisUrl: "redis://localhost:6379",
    });
    mockGetResponseSnapshotForPipeline.mockResolvedValue(null);

    await enqueueResponsePipelineEvents({
      environmentId: "env_123",
      events: ["responseUpdated"],
      responseId: "cm9-response-id",
      surveyId: "cm9-survey-id",
    });

    expect(mockWarn).toHaveBeenCalledWith(
      {
        environmentId: "env_123",
        events: ["responseUpdated"],
        responseId: "cm9-response-id",
        surveyId: "cm9-survey-id",
      },
      "BullMQ response pipeline enqueue skipped because the response snapshot was not found"
    );
    expect(mockEnqueueResponsePipeline).not.toHaveBeenCalled();
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

  test("logs enqueue failures without throwing", async () => {
    const enqueueError = new Error("redis unavailable");
    mockGetJobsQueueingConfig.mockReturnValue({
      enabled: true,
      redisUrl: "redis://localhost:6379",
    });
    mockGetResponseSnapshotForPipeline.mockResolvedValue(mockResponse);
    mockEnqueueResponsePipeline.mockRejectedValue(enqueueError);

    await expect(
      enqueueResponsePipelineEvents({
        environmentId: "env_123",
        events: ["responseFinished"],
        responseId: "cm9-response-id",
        surveyId: "cm9-survey-id",
      })
    ).resolves.toBeUndefined();

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
