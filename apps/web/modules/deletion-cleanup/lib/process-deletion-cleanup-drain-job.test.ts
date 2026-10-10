import { beforeEach, describe, expect, test, vi } from "vitest";
import { logger } from "@formbricks/logger";
import { drainDeletionCleanups } from "./drain";
import { processDeletionCleanupDrainJob } from "./process-deletion-cleanup-drain-job";

vi.mock("server-only", () => ({}));
vi.mock("@formbricks/logger", () => ({ logger: { info: vi.fn() } }));
vi.mock("./drain", () => ({ drainDeletionCleanups: vi.fn() }));

/** The drain itself is proven against a real database in `deletion-cleanup.integration.test.ts`. */
describe("processDeletionCleanupDrainJob", () => {
  const context = { jobId: "job-1", jobName: "deletion-cleanup.drain" } as never;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("drains the whole queue and logs only when it acted", async () => {
    vi.mocked(drainDeletionCleanups).mockResolvedValueOnce({ done: 0, again: 0, failed: 0 });
    await processDeletionCleanupDrainJob({ scope: "global" } as never, context);

    expect(drainDeletionCleanups).toHaveBeenCalledWith();
    expect(logger.info).not.toHaveBeenCalled();

    vi.mocked(drainDeletionCleanups).mockResolvedValueOnce({ done: 1, again: 0, failed: 2 });
    await processDeletionCleanupDrainJob({ scope: "global" } as never, context);

    expect(logger.info).toHaveBeenCalledWith(
      { jobId: "job-1", jobName: "deletion-cleanup.drain", scope: "global", done: 1, again: 0, failed: 2 },
      "Deletion cleanup drain acted"
    );
  });
});
