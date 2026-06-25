import { beforeEach, describe, expect, test, vi } from "vitest";
import { Prisma } from "@formbricks/database/prisma";
import { enqueueResponseCompletedWorkflowRuns } from "./enqueue-response-completed-runs";

const { findMany, create, findUnique } = vi.hoisted(() => ({
  findMany: vi.fn(),
  create: vi.fn(),
  findUnique: vi.fn(),
}));
const { warn, error } = vi.hoisted(() => ({ warn: vi.fn(), error: vi.fn() }));

vi.mock("@formbricks/database", () => ({
  prisma: { workflow: { findMany }, workflowRun: { create, findUnique } },
}));
vi.mock("@formbricks/logger", () => ({ logger: { warn, error } }));

const workspaceId = "cm9zr4mps000008l8btfy1vtz";
const surveyId = "cm9zr4q7i000108l84gozfggr";
const responseId = "cm9zr4resp0000000000000a1";
const endingId = "cm9zr4q7i000108l84goze001";

const response = {
  id: responseId,
  surveyId,
  finished: true,
  endingId,
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

const run = (input = { response, workspaceId, dispatch }) => enqueueResponseCompletedWorkflowRuns(input);

beforeEach(() => {
  vi.clearAllMocks();
  dispatch.mockResolvedValue(undefined);
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
  });

  test("does nothing for an unfinished response", async () => {
    await run({ response: { ...response, finished: false }, workspaceId, dispatch });
    expect(findMany).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
    expect(dispatch).not.toHaveBeenCalled();
  });

  test("does nothing when no ending card was reached", async () => {
    await run({ response: { ...response, endingId: null }, workspaceId, dispatch });
    expect(findMany).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
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
});
