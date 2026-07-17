import { beforeEach, describe, expect, test, vi } from "vitest";
import { markWorkflowRunDispatched } from "./mark-dispatched";

const { updateMany } = vi.hoisted(() => ({ updateMany: vi.fn() }));
const { error } = vi.hoisted(() => ({ error: vi.fn() }));

vi.mock("@formbricks/database", () => ({ prisma: { workflowRun: { updateMany } } }));
vi.mock("@formbricks/logger", () => ({ logger: { error } }));

const AT = new Date("2026-07-01T12:00:00.000Z");

beforeEach(() => {
  vi.clearAllMocks();
  updateMany.mockResolvedValue({ count: 1 });
});

describe("markWorkflowRunDispatched", () => {
  test("stamps dispatchedAt on the run, tenant-scoped by workspaceId", async () => {
    await markWorkflowRunDispatched("run_1", "ws_1", AT);

    expect(updateMany).toHaveBeenCalledWith({
      where: { id: "run_1", workspaceId: "ws_1" },
      data: { dispatchedAt: AT },
    });
    expect(error).not.toHaveBeenCalled();
  });

  test("swallows a write failure and logs it (best-effort; never throws)", async () => {
    updateMany.mockRejectedValueOnce(new Error("db down"));

    await expect(markWorkflowRunDispatched("run_1", "ws_1", AT, { jobId: "j1" })).resolves.toBeUndefined();

    expect(error).toHaveBeenCalledTimes(1);
    expect(error).toHaveBeenCalledWith(
      expect.objectContaining({ workflowRunId: "run_1", workspaceId: "ws_1", jobId: "j1" }),
      expect.any(String)
    );
  });
});
