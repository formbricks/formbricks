import { beforeEach, describe, expect, test, vi } from "vitest";
import { markWorkflowRunDispatched } from "./mark-dispatched";

const { update } = vi.hoisted(() => ({ update: vi.fn() }));
const { error } = vi.hoisted(() => ({ error: vi.fn() }));

vi.mock("@formbricks/database", () => ({ prisma: { workflowRun: { update } } }));
vi.mock("@formbricks/logger", () => ({ logger: { error } }));

const AT = new Date("2026-07-01T12:00:00.000Z");

beforeEach(() => {
  vi.clearAllMocks();
  update.mockResolvedValue({});
});

describe("markWorkflowRunDispatched", () => {
  test("stamps dispatchedAt on the run by id", async () => {
    await markWorkflowRunDispatched("run_1", AT);

    expect(update).toHaveBeenCalledWith({ where: { id: "run_1" }, data: { dispatchedAt: AT } });
    expect(error).not.toHaveBeenCalled();
  });

  test("swallows a write failure and logs it (best-effort; never throws)", async () => {
    update.mockRejectedValueOnce(new Error("db down"));

    await expect(markWorkflowRunDispatched("run_1", AT, { jobId: "j1" })).resolves.toBeUndefined();

    expect(error).toHaveBeenCalledTimes(1);
    expect(error).toHaveBeenCalledWith(
      expect.objectContaining({ workflowRunId: "run_1", jobId: "j1" }),
      expect.any(String)
    );
  });
});
