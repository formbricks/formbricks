import { beforeEach, describe, expect, test, vi } from "vitest";
import { logger } from "@formbricks/logger";
import { processCreativeStatsFlushJob } from "./process-creative-stats-flush-job";
import { flushCreativeCounters } from "./stats-flush";

vi.mock("@formbricks/logger", () => ({ logger: { debug: vi.fn() } }));
vi.mock("./stats-flush", () => ({ flushCreativeCounters: vi.fn() }));

/** The flush itself is proven against a real Redis and PostgreSQL in `stats-flush.integration.test.ts`. */
describe("processCreativeStatsFlushJob", () => {
  const context = { jobId: "job-1", jobName: "creative-stats.flush" } as never;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("flushes the counters and logs only when it wrote something", async () => {
    vi.mocked(flushCreativeCounters).mockResolvedValueOnce({ flushed: 0 });
    await processCreativeStatsFlushJob({ scope: "global" } as never, context);

    expect(flushCreativeCounters).toHaveBeenCalledWith();
    expect(logger.debug).not.toHaveBeenCalled();

    vi.mocked(flushCreativeCounters).mockResolvedValueOnce({ flushed: 3 });
    await processCreativeStatsFlushJob({ scope: "global" } as never, context);

    expect(logger.debug).toHaveBeenCalledWith(
      { jobId: "job-1", jobName: "creative-stats.flush", scope: "global", flushed: 3 },
      "Creative counters flushed"
    );
  });

  test("lets a failed flush fail the job, so BullMQ retries it", async () => {
    vi.mocked(flushCreativeCounters).mockRejectedValueOnce(new Error("connection refused"));

    await expect(processCreativeStatsFlushJob({ scope: "global" } as never, context)).rejects.toThrow(
      "connection refused"
    );
  });
});
