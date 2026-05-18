import { PipelineTriggers } from "@prisma/client";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { TResponsePipelineJobData, getBackgroundJobProducer } from "@formbricks/jobs";
import { logger } from "@formbricks/logger";
import { TResponse } from "@formbricks/types/responses";
import { sendToPipeline } from "@/app/lib/pipelines";
import { getJobsQueueingConfig } from "@/lib/jobs/config";

const mockEnqueueResponsePipeline = vi.fn();

vi.mock("@formbricks/jobs", () => ({
  getBackgroundJobProducer: vi.fn(() => ({
    enqueueResponsePipeline: mockEnqueueResponsePipeline,
  })),
}));

vi.mock("@/lib/jobs/config", () => ({
  getJobsQueueingConfig: vi.fn(),
}));

vi.mock("@formbricks/logger", () => ({
  logger: {
    error: vi.fn(),
  },
}));

describe("sendToPipeline", () => {
  const testData: TResponsePipelineJobData = {
    event: PipelineTriggers.responseCreated,
    surveyId: "cm8ckvchx000008lb710n0gdn",
    workspaceId: "cm8cmp9hp000008jf7l570ml2",
    response: { id: "cm8cmpnjj000108jfdr9dfqe6" } as TResponse,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getJobsQueueingConfig).mockReturnValue({
      enabled: true,
      redisUrl: "redis://localhost:6379",
    });
  });

  test("enqueues the pipeline job through the BullMQ producer", async () => {
    mockEnqueueResponsePipeline.mockResolvedValue({
      jobId: "job-1",
      jobName: "response-pipeline.process",
      queueName: "background-jobs",
    });

    await sendToPipeline(testData);

    expect(getBackgroundJobProducer).toHaveBeenCalledTimes(1);
    expect(mockEnqueueResponsePipeline).toHaveBeenCalledWith(testData);
  });

  test("logs enqueue failures and rethrows", async () => {
    const testError = new Error("Redis unavailable");
    mockEnqueueResponsePipeline.mockRejectedValue(testError);

    await expect(sendToPipeline(testData)).rejects.toThrow(testError);

    expect(logger.error).toHaveBeenCalledWith(
      {
        error: testError,
        event: testData.event,
        surveyId: testData.surveyId,
        workspaceId: testData.workspaceId,
      },
      "Error queueing pipeline event"
    );
  });

  test("throws when BullMQ queueing is disabled", async () => {
    vi.mocked(getJobsQueueingConfig).mockReturnValue({
      enabled: false,
      redisUrl: null,
    });

    await expect(sendToPipeline(testData)).rejects.toThrow(
      "BullMQ response pipeline queueing is not enabled"
    );
    expect(getBackgroundJobProducer).not.toHaveBeenCalled();
  });
});
