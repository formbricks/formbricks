import { beforeEach, describe, expect, test, vi } from "vitest";
import { Prisma } from "@formbricks/database/prisma";
import { enqueueResponseCompletedWorkflowRuns } from "./enqueue-response-completed-runs";

const { findMany, create, findUnique } = vi.hoisted(() => ({
  findMany: vi.fn(),
  create: vi.fn(),
  findUnique: vi.fn(),
}));
const { warn, error, info } = vi.hoisted(() => ({ warn: vi.fn(), error: vi.fn(), info: vi.fn() }));
const { markDispatched } = vi.hoisted(() => ({ markDispatched: vi.fn() }));
const { getIsWorkflowsEnabled } = vi.hoisted(() => ({ getIsWorkflowsEnabled: vi.fn() }));

vi.mock("@formbricks/database", () => ({
  prisma: { workflow: { findMany }, workflowRun: { create, findUnique } },
}));
vi.mock("@formbricks/logger", () => ({ logger: { warn, error, info } }));
vi.mock("./mark-dispatched", () => ({ markWorkflowRunDispatched: markDispatched }));
vi.mock("@/modules/ee/license-check/lib/utils", () => ({ getIsWorkflowsEnabled }));

const workspaceId = "cm9zr4mps000008l8btfy1vtz";
const organizationId = "cm9zr4org000008l8btfy1org";
const surveyId = "cm9zr4q7i000108l84gozfggr";
const responseId = "cm9zr4resp0000000000000a1";
const endingId = "cm9zr4q7i000108l84goze001";

const response = {
  id: responseId,
  surveyId,
  finished: true,
  // Widened so tests can spread in `endingId: null` (matches RunnerResponse's `string | null`).
  endingId: endingId as string | null,
  updatedAt: new Date("2026-06-12T09:30:00.000Z"),
  data: { q1: "answer" },
};

const definition = (config: { surveyId: string; endingCardIds: string[] }) => ({
  schemaVersion: 1,
  trigger: { id: "trigger", type: "trigger", triggerType: "response.completed", config },
  nodes: [],
  edges: [],
  entryNodeId: "trigger",
});

// One enabled workflow whose published version targets the response's survey (any ending).
const enabledWorkflow = (workflowId: string, versionId: string, endingCardIds: string[] = []) => ({
  id: workflowId,
  versions: [{ id: versionId, definition: definition({ surveyId, endingCardIds }) }],
});

const dispatch =
  vi.fn<(input: { workflowRunId: string; workflowId: string; workspaceId: string }) => Promise<void>>();

const run = (input = { response, workspaceId, organizationId, dispatch }) =>
  enqueueResponseCompletedWorkflowRuns(input);

beforeEach(() => {
  vi.clearAllMocks();
  dispatch.mockResolvedValue(undefined);
  // Entitled by default; the entitlement-skip tests flip this off explicitly.
  getIsWorkflowsEnabled.mockResolvedValue(true);
});

describe("enqueueResponseCompletedWorkflowRuns", () => {
  test("creates a queued run bound to the published version and dispatches it", async () => {
    findMany.mockResolvedValue([enabledWorkflow("wf_1", "ver_1")]);
    create.mockResolvedValue({ id: "run_1" });

    await run();

    const data = create.mock.calls[0][0].data;
    expect(data).toMatchObject({
      workflowId: "wf_1",
      workspaceId,
      workflowVersionId: "ver_1",
      status: "queued",
      triggerType: "response.completed",
      surveyId,
      responseId,
      isDryRun: false,
      attempt: 0,
      idempotencyKey: responseId,
    });
    expect(data.triggerPayload).toMatchObject({
      type: "response.completed",
      surveyId,
      responseId,
      endingCardId: endingId,
      triggeredAt: response.updatedAt.toISOString(),
    });
    expect(dispatch).toHaveBeenCalledWith({ workflowRunId: "run_1", workflowId: "wf_1", workspaceId });
    // Dispatch landed → recorded as a durable DB fact (ENG-1658), tenant-scoped by workspaceId.
    expect(markDispatched).toHaveBeenCalledWith(
      "run_1",
      workspaceId,
      expect.any(Date),
      expect.objectContaining({ workflowId: "wf_1" })
    );
  });

  test("does nothing for an unfinished response", async () => {
    await run({ response: { ...response, finished: false }, workspaceId, organizationId, dispatch });
    expect(findMany).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
    expect(dispatch).not.toHaveBeenCalled();
  });

  test("a response without an ending card still fires an all-endings workflow", async () => {
    findMany.mockResolvedValue([enabledWorkflow("wf_1", "ver_1")]);
    create.mockResolvedValue({ id: "run_1" });

    await run({ response: { ...response, endingId: null }, workspaceId, organizationId, dispatch });

    const data = create.mock.calls[0][0].data;
    expect(data).toMatchObject({ workflowId: "wf_1", status: "queued" });
    // No ending was reached, so the payload simply omits endingCardId (it is optional).
    expect(data.triggerPayload.endingCardId).toBeUndefined();
    expect(dispatch).toHaveBeenCalledTimes(1);
  });

  test("a response without an ending card does not fire an ending-specific workflow", async () => {
    findMany.mockResolvedValue([enabledWorkflow("wf_1", "ver_1", [endingId])]);

    await run({ response: { ...response, endingId: null }, workspaceId, organizationId, dispatch });

    expect(create).not.toHaveBeenCalled();
    expect(dispatch).not.toHaveBeenCalled();
  });

  test("respects the ending-card filter (specific list, miss → no run)", async () => {
    findMany.mockResolvedValue([enabledWorkflow("wf_1", "ver_1", ["cm9zr4q7i000108l84goze999"])]);
    await run();
    expect(create).not.toHaveBeenCalled();
    expect(dispatch).not.toHaveBeenCalled();
  });

  test("skips (and logs) an enabled workflow with no published version", async () => {
    findMany.mockResolvedValue([{ id: "wf_1", versions: [] }]);
    await run();
    expect(warn).toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
    expect(dispatch).not.toHaveBeenCalled();
  });

  test("fans out to every matching workflow", async () => {
    findMany.mockResolvedValue([enabledWorkflow("wf_1", "ver_1"), enabledWorkflow("wf_2", "ver_2")]);
    create.mockResolvedValueOnce({ id: "run_1" }).mockResolvedValueOnce({ id: "run_2" });

    await run();

    expect(create).toHaveBeenCalledTimes(2);
    expect(dispatch).toHaveBeenCalledTimes(2);
    expect(dispatch).toHaveBeenCalledWith({ workflowRunId: "run_1", workflowId: "wf_1", workspaceId });
    expect(dispatch).toHaveBeenCalledWith({ workflowRunId: "run_2", workflowId: "wf_2", workspaceId });
  });

  test("is idempotent on a unique-constraint violation (replayed pipeline): re-dispatches the existing run", async () => {
    findMany.mockResolvedValue([enabledWorkflow("wf_1", "ver_1")]);
    create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "test",
      })
    );
    findUnique.mockResolvedValue({ id: "existing_run" });

    await run();

    expect(dispatch).toHaveBeenCalledWith({ workflowRunId: "existing_run", workflowId: "wf_1", workspaceId });
    expect(error).not.toHaveBeenCalled();
  });

  test("on a unique violation with no findable existing run, surfaces an error and does not dispatch", async () => {
    findMany.mockResolvedValue([enabledWorkflow("wf_1", "ver_1")]);
    create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "test",
      })
    );
    findUnique.mockResolvedValue(null);

    await expect(run()).resolves.toBeUndefined();

    expect(dispatch).not.toHaveBeenCalled();
    // A unique violation with no recoverable run is a contradictory state; surface it, don't hide it.
    expect(error).toHaveBeenCalled();
  });

  test("propagates a database error raised during candidate load (does not swallow it before matching)", async () => {
    findMany.mockRejectedValue(new Error("Timed out fetching a new connection from the connection pool"));

    await expect(run()).rejects.toThrow(/connection pool/i);
    expect(create).not.toHaveBeenCalled();
    expect(dispatch).not.toHaveBeenCalled();
  });

  test("rethrows a transient pool-exhaustion error raised during run creation so the pipeline can retry", async () => {
    findMany.mockResolvedValue([enabledWorkflow("wf_1", "ver_1")]);
    create.mockRejectedValue(new Error("Timed out fetching a new connection from the connection pool"));

    await expect(run()).rejects.toThrow(/connection pool/i);
    expect(dispatch).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
  });

  test("isolates a non-unique create failure (logs, does not throw, continues fan-out)", async () => {
    findMany.mockResolvedValue([enabledWorkflow("wf_1", "ver_1"), enabledWorkflow("wf_2", "ver_2")]);
    create.mockRejectedValueOnce(new Error("db down")).mockResolvedValueOnce({ id: "run_2" });

    await expect(run()).resolves.toBeUndefined();

    expect(error).toHaveBeenCalled();
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith({ workflowRunId: "run_2", workflowId: "wf_2", workspaceId });
  });

  test("creates nothing when no workflow matches the survey", async () => {
    findMany.mockResolvedValue([
      {
        id: "wf_other",
        versions: [
          { id: "v", definition: definition({ surveyId: "cm9zr4q7i000108l84gozzzzz", endingCardIds: [] }) },
        ],
      },
    ]);
    await run();
    expect(create).not.toHaveBeenCalled();
    expect(dispatch).not.toHaveBeenCalled();
  });

  test("skips (and logs) a published version with a malformed trigger, still processing the others", async () => {
    findMany.mockResolvedValue([
      // No trigger at all — a malformed/corrupt published snapshot.
      { id: "wf_bad", versions: [{ id: "ver_bad", definition: { schemaVersion: 1, nodes: [], edges: [] } }] },
      enabledWorkflow("wf_ok", "ver_ok"),
    ]);
    create.mockResolvedValue({ id: "run_ok" });

    await run();

    expect(warn).toHaveBeenCalled();
    expect(create).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith({ workflowRunId: "run_ok", workflowId: "wf_ok", workspaceId });
  });

  test("logs an orphan and does not throw when dispatch fails after the run is persisted", async () => {
    findMany.mockResolvedValue([enabledWorkflow("wf_1", "ver_1")]);
    create.mockResolvedValue({ id: "run_1" });
    dispatch.mockRejectedValue(new Error("redis unavailable"));

    await expect(run()).resolves.toBeUndefined();

    // Attempted once (not retried here), the persisted run is surfaced as an orphan for the reconciler.
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(error).toHaveBeenCalled();
    // Dispatch failed → the run is left unmarked (dispatchedAt stays null) for the reconciler to recover.
    expect(markDispatched).not.toHaveBeenCalled();
  });

  test("skips (and logs) enqueueing when the organization lacks the workflows entitlement", async () => {
    findMany.mockResolvedValue([enabledWorkflow("wf_1", "ver_1")]);
    getIsWorkflowsEnabled.mockResolvedValue(false);

    await run();

    expect(getIsWorkflowsEnabled).toHaveBeenCalledWith(organizationId);
    expect(info).toHaveBeenCalledWith(
      expect.objectContaining({ workspaceId, organizationId, responseId, matchedWorkflowIds: ["wf_1"] }),
      expect.stringContaining("entitlement")
    );
    expect(create).not.toHaveBeenCalled();
    expect(dispatch).not.toHaveBeenCalled();
  });

  test("does not pay the entitlement lookup when no workflow matches the response", async () => {
    findMany.mockResolvedValue([]);

    await run();

    expect(getIsWorkflowsEnabled).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });
});
