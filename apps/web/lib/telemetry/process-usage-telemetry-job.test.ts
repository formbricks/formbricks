import { beforeEach, describe, expect, test, vi } from "vitest";
import type { JobExecutionContext } from "@formbricks/jobs";
import { logger } from "@formbricks/logger";
import { sendTelemetryEvents } from "@/lib/telemetry/usage-update";
import { processUsageTelemetryJob } from "./process-usage-telemetry-job";

vi.mock("@/lib/telemetry/usage-update", () => ({
  sendTelemetryEvents: vi.fn(),
}));

vi.mock("@formbricks/logger", () => ({
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

const context: JobExecutionContext = {
  attempt: 1,
  jobId: "job-1",
  jobName: "usage-telemetry.process",
  maxAttempts: 3,
  queueName: "background-jobs",
};

describe("processUsageTelemetryJob", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("sends the instance usage update", async () => {
    vi.mocked(sendTelemetryEvents).mockResolvedValue(undefined);

    await processUsageTelemetryJob({ scope: "global" }, context);

    expect(sendTelemetryEvents).toHaveBeenCalledTimes(1);
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({ jobId: "job-1", scope: "global" }),
      "Usage telemetry job completed"
    );
  });

  test("propagates a dispatch failure so the job is retried", async () => {
    const error = new Error("telemetry offline");
    vi.mocked(sendTelemetryEvents).mockRejectedValue(error);

    await expect(processUsageTelemetryJob({ scope: "global" }, context)).rejects.toThrow("telemetry offline");

    expect(logger.info).not.toHaveBeenCalledWith(expect.anything(), "Usage telemetry job completed");
  });
});
