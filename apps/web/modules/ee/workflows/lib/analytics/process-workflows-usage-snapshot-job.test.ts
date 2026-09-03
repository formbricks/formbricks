import { beforeEach, describe, expect, test, vi } from "vitest";
import { emitWorkflowUsageSnapshots } from "./usage-snapshot";

const mocks = vi.hoisted(() => ({ constants: { POSTHOG_KEY: "phc_test" as string | undefined } }));

vi.mock("server-only", () => ({}));
vi.mock("@formbricks/logger", () => ({ logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() } }));
vi.mock("@/lib/constants", () => mocks.constants);
vi.mock("./usage-snapshot", () => ({ emitWorkflowUsageSnapshots: vi.fn() }));

const context = { attempt: 1, jobId: "job_1", jobName: "workflows-usage.snapshot", maxAttempts: 3, queueName: "background-jobs" };

describe("processWorkflowsUsageSnapshotJob", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.constants.POSTHOG_KEY = "phc_test";
    vi.mocked(emitWorkflowUsageSnapshots).mockResolvedValue({ organizations: 1, workspaces: 1, events: 2 });
  });

  test("emits the snapshot when PostHog is configured", async () => {
    const { processWorkflowsUsageSnapshotJob } = await import("./process-workflows-usage-snapshot-job");

    await processWorkflowsUsageSnapshotJob({ scope: "global" }, context);

    expect(emitWorkflowUsageSnapshots).toHaveBeenCalledTimes(1);
    expect(vi.mocked(emitWorkflowUsageSnapshots).mock.calls[0][0]).toBeInstanceOf(Date);
  });

  test("skips the read pass entirely without POSTHOG_KEY", async () => {
    mocks.constants.POSTHOG_KEY = undefined;
    const { processWorkflowsUsageSnapshotJob } = await import("./process-workflows-usage-snapshot-job");

    await processWorkflowsUsageSnapshotJob({ scope: "global" }, context);

    expect(emitWorkflowUsageSnapshots).not.toHaveBeenCalled();
  });
});
