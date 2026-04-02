import { PipelineTriggers } from "@prisma/client";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { logger } from "@formbricks/logger";
import { TResponse } from "@formbricks/types/responses";
import { enqueuePipelineJob, triggerPipelineDrain } from "@/app/lib/pipeline-queue";
import { sendToPipeline } from "@/app/lib/pipelines";
import { TPipelineInput } from "@/app/lib/types/pipelines";

vi.mock("@/app/lib/pipeline-queue", () => ({
  enqueuePipelineJob: vi.fn(),
  triggerPipelineDrain: vi.fn(),
}));

vi.mock("@formbricks/logger", () => ({
  logger: {
    error: vi.fn(),
  },
}));

describe("sendToPipeline", () => {
  const testData: TPipelineInput = {
    event: PipelineTriggers.responseCreated,
    surveyId: "cm8ckvchx000008lb710n0gdn",
    workspaceId: "cm8cmp9hp000008jf7l570ml2",
    response: { id: "cm8cmpnjj000108jfdr9dfqe6" } as TResponse,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("enqueues the pipeline job and triggers draining", async () => {
    vi.mocked(enqueuePipelineJob).mockResolvedValue({
      ...testData,
      jobId: "job-1",
      attempt: 1,
      enqueuedAt: Date.now(),
      notBefore: null,
    });

    await sendToPipeline(testData);

    expect(enqueuePipelineJob).toHaveBeenCalledWith(testData);
    expect(triggerPipelineDrain).toHaveBeenCalledTimes(1);
  });

  test("logs enqueue failures and rethrows", async () => {
    const testError = new Error("Redis unavailable");
    vi.mocked(enqueuePipelineJob).mockRejectedValue(testError);

    await expect(sendToPipeline(testData)).rejects.toThrow(testError);

    expect(triggerPipelineDrain).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith(
      { error: testError, event: testData.event, surveyId: testData.surveyId },
      "Error queueing pipeline event"
    );
  });
};
