import { beforeEach, describe, expect, test, vi } from "vitest";
import { logger } from "@formbricks/logger";
import { RETENTION_SWEEPERS, processDataRetentionSweepJob } from "./process-data-retention-sweep-job";
import { runDataRetentionSweep } from "./sweep";

vi.mock("server-only", () => ({}));
vi.mock("@formbricks/logger", () => ({ logger: { info: vi.fn(), error: vi.fn() } }));
vi.mock("./sweep", () => ({ runDataRetentionSweep: vi.fn() }));
vi.mock("./responses-sweeper", () => ({ createResponsesSweeper: () => vi.fn() }));
vi.mock("./surveys-sweeper", () => ({ createSurveysSweeper: () => vi.fn() }));
vi.mock("./members-sweeper", () => ({ createMembersSweeper: () => vi.fn() }));

/** The sweep itself is proven against a real database in `sweep.integration.test.ts`. */
describe("processDataRetentionSweepJob", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("runs the sweep with a sweeper for every policy and logs its summary", async () => {
    const summary = { organizations: 2, unlicensed: 1, runs: 3, failedRuns: 0, deferred: 0 };
    vi.mocked(runDataRetentionSweep).mockResolvedValue(summary);

    await processDataRetentionSweepJob(
      { scope: "global" } as never,
      {
        jobId: "job-1",
        jobName: "data-retention.sweep",
      } as never
    );

    expect(Object.keys(RETENTION_SWEEPERS).sort()).toEqual(["members", "responses", "surveys"]);
    expect(runDataRetentionSweep).toHaveBeenCalledWith({ sweepers: RETENTION_SWEEPERS });
    expect(logger.info).toHaveBeenLastCalledWith(
      { jobId: "job-1", jobName: "data-retention.sweep", scope: "global", ...summary },
      "Data retention sweep completed"
    );
  });

  test("lets an infrastructure failure fail the job", async () => {
    const failure = new Error("database unreachable");
    vi.mocked(runDataRetentionSweep).mockRejectedValue(failure);

    await expect(
      processDataRetentionSweepJob({ scope: "global" } as never, { jobId: "job-1" } as never)
    ).rejects.toBe(failure);
    expect(logger.info).not.toHaveBeenCalledWith(expect.anything(), "Data retention sweep completed");
  });
});
