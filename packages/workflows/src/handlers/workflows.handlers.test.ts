import { beforeEach, describe, expect, test, vi } from "vitest";
import { WorkflowConflictError, WorkflowInvalidInputError } from "../errors";
import type {
  WorkflowRowWithLastRun,
  WorkflowRunRow,
  WorkflowRunWithLogsRow,
  WorkflowsLogger,
} from "../services/ports";
import type { WorkflowsService } from "../services/workflows.service";
import type { TWorkflowTriggerRunPayload } from "../types/runs";
import type { AuthorizedWorkspace, WorkflowApiContext } from "./context";
import { createWorkflowsHandlers } from "./workflows.handlers";

const surveyId = "cm9zr4q7i000108l84gozfggr";
const workspaceId = "cm9zr4mps000008l8btfy1vtz";
const workflowId = "cm9zr4t2b000208l8h2m1aq3c";
const responseId = "cm9zr4rsp000708l8bqccpfrx";

const definition = {
  schemaVersion: 1 as const,
  trigger: {
    id: "trigger",
    type: "trigger" as const,
    triggerType: "response.completed" as const,
    config: { surveyId, endingCardIds: [] },
  },
  nodes: [
    {
      id: "send-email",
      type: "action" as const,
      actionType: "send_email" as const,
      config: {
        from: "noreply@example.com",
        to: "support@example.com",
        replyTo: ["support@example.com"],
        subject: "Thanks",
        body: "Thanks for your response.",
        attachResponseData: true,
      },
    },
  ],
  edges: [{ id: "e1", source: "trigger", target: "send-email" }],
  entryNodeId: "trigger",
};

const makeRow = (overrides: Partial<WorkflowRowWithLastRun> = {}): WorkflowRowWithLastRun => ({
  id: workflowId,
  createdAt: new Date("2026-06-11T09:30:00.000Z"),
  updatedAt: new Date("2026-06-12T09:30:00.000Z"),
  name: "Notify team",
  description: null,
  status: "draft",
  workspaceId,
  createdBy: null,
  creator: null,
  definition,
  runs: [],
  ...overrides,
});

const service = {
  listWorkflows: vi.fn<WorkflowsService["listWorkflows"]>(),
  createWorkflow: vi.fn<WorkflowsService["createWorkflow"]>(),
  getWorkflowById: vi.fn<WorkflowsService["getWorkflowById"]>(),
  updateWorkflow: vi.fn<WorkflowsService["updateWorkflow"]>(),
  duplicateWorkflow: vi.fn<WorkflowsService["duplicateWorkflow"]>(),
  deleteWorkflow: vi.fn<WorkflowsService["deleteWorkflow"]>(),
  setStatus: vi.fn<WorkflowsService["setStatus"]>(),
  enableWorkflow: vi.fn<WorkflowsService["enableWorkflow"]>(),
  disableWorkflow: vi.fn<WorkflowsService["disableWorkflow"]>(),
  listWorkflowRuns: vi.fn<WorkflowsService["listWorkflowRuns"]>(),
  getWorkflowRun: vi.fn<WorkflowsService["getWorkflowRun"]>(),
};
const handlers = createWorkflowsHandlers(service);

const readJson = async <T>(res: Response): Promise<T> => (await res.json()) as T;

const authorizeAllow = vi.fn<WorkflowApiContext["authorize"]>();
const verifyTriggerSurvey = vi.fn<WorkflowApiContext["verifyTriggerSurvey"]>();
const logger: WorkflowsLogger = { warn: vi.fn(), error: vi.fn() };

const authorized: AuthorizedWorkspace = { workspaceId, organizationId: "cm9zr5org00000000000000000" };

const makeCtx = (overrides: Partial<WorkflowApiContext> = {}): WorkflowApiContext => ({
  userId: "cm9zr52kh000508l8e3q7bw9j",
  requestId: "req_1",
  instance: "https://app.formbricks.com",
  logger,
  authorize: authorizeAllow,
  verifyTriggerSurvey,
  ...overrides,
});

const deniedResponse = (): Response =>
  Response.json(
    { title: "Forbidden", status: 403, detail: "denied", requestId: "req_1", code: "forbidden" },
    { status: 403, headers: { "Content-Type": "application/problem+json" } }
  );

beforeEach(() => {
  vi.clearAllMocks();
  authorizeAllow.mockResolvedValue(authorized);
  verifyTriggerSurvey.mockResolvedValue({ surveyExists: true, missingEndingCardIds: [] });
});

describe("get", () => {
  test("returns 403 (not 404) when the workflow does not exist", async () => {
    service.getWorkflowById.mockResolvedValue(null);

    const res = await handlers.get({ ctx: makeCtx(), params: { workflowId } });

    expect(res.status).toBe(403);
    expect(authorizeAllow).not.toHaveBeenCalled();
    const body = await readJson<{ code: string }>(res);
    expect(body.code).toBe("forbidden");
  });

  test("returns the denial response when the caller lacks workspace access", async () => {
    service.getWorkflowById.mockResolvedValue(makeRow());
    const ctx = makeCtx({ authorize: vi.fn().mockResolvedValue(deniedResponse()) });

    const res = await handlers.get({ ctx, params: { workflowId } });

    expect(res.status).toBe(403);
  });

  test("returns 200 with the workflow resource on success", async () => {
    service.getWorkflowById.mockResolvedValue(makeRow());

    const res = await handlers.get({ ctx: makeCtx(), params: { workflowId } });

    expect(res.status).toBe(200);
    expect(res.headers.get("X-Request-Id")).toBe("req_1");
    const body = await readJson<{ data: { id: string; triggerType: string; definition: unknown } }>(res);
    expect(body.data.id).toBe(workflowId);
    expect(body.data.triggerType).toBe("response.completed");
    expect(body.data.definition).toBeDefined();
  });

  test("returns 500 when the serialized output fails its resource schema", async () => {
    const badRow = makeRow({
      definition: {
        ...definition,
        trigger: { ...definition.trigger, config: { surveyId: "not-a-cuid", endingCardIds: [] } },
      },
    });
    service.getWorkflowById.mockResolvedValue(badRow);

    const res = await handlers.get({ ctx: makeCtx(), params: { workflowId } });

    expect(res.status).toBe(500);
    expect(logger.error).toHaveBeenCalled();
  });
});

describe("create", () => {
  const postRequest = (body: unknown): Request =>
    new Request("http://localhost/api/v3/workflows", {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    });

  test("creates a draft and returns 201 with a Location header", async () => {
    service.createWorkflow.mockResolvedValue(makeRow());

    const res = await handlers.create({
      req: postRequest({ workspaceId, name: "Notify team", definition }),
      ctx: makeCtx(),
    });

    expect(res.status).toBe(201);
    expect(res.headers.get("Location")).toBe(`/api/v3/workflows/${workflowId}`);
    expect(service.createWorkflow).toHaveBeenCalledWith(expect.objectContaining({ workspaceId }), {
      createdBy: "cm9zr52kh000508l8e3q7bw9j",
    });
  });

  test("rejects an invalid definition with 400 and invalid_params", async () => {
    const res = await handlers.create({
      req: postRequest({
        workspaceId,
        name: "Broken",
        definition: { schemaVersion: 1, trigger: {}, nodes: [], edges: [], entryNodeId: "trigger" },
      }),
      ctx: makeCtx(),
    });

    expect(res.status).toBe(400);
    const body = await readJson<{ code: string; invalid_params: unknown }>(res);
    expect(body.code).toBe("bad_request");
    expect(Array.isArray(body.invalid_params)).toBe(true);
    expect(service.createWorkflow).not.toHaveBeenCalled();
  });

  test("returns the denial response without creating when access is missing", async () => {
    const ctx = makeCtx({ authorize: vi.fn().mockResolvedValue(deniedResponse()) });

    const res = await handlers.create({
      req: postRequest({ workspaceId, name: "Notify team", definition }),
      ctx,
    });

    expect(res.status).toBe(403);
    expect(service.createWorkflow).not.toHaveBeenCalled();
  });

  test("rejects a malformed JSON body with 400", async () => {
    const req = new Request("http://localhost/api/v3/workflows", {
      method: "POST",
      body: "{ not valid json",
      headers: { "Content-Type": "application/json" },
    });

    const res = await handlers.create({ req, ctx: makeCtx() });

    expect(res.status).toBe(400);
    expect(service.createWorkflow).not.toHaveBeenCalled();
  });

  test("rejects a body that exceeds the size limit with 400", async () => {
    const oversizedName = "x".repeat(2 * 1024 * 1024 + 1);

    const res = await handlers.create({
      req: postRequest({ workspaceId, name: oversizedName, definition }),
      ctx: makeCtx(),
    });

    expect(res.status).toBe(400);
    expect(service.createWorkflow).not.toHaveBeenCalled();
  });
});

describe("list", () => {
  const listRequest = (query: string): Request => new Request(`http://localhost/api/v3/workflows?${query}`);

  test("returns 200 with a cursor-paginated envelope", async () => {
    service.listWorkflows.mockResolvedValue({ workflows: [makeRow()], nextCursor: null });

    const res = await handlers.list({
      req: listRequest(`workspaceId=${workspaceId}&sortBy=name`),
      ctx: makeCtx(),
    });

    expect(res.status).toBe(200);
    const body = await readJson<{ data: unknown[]; meta: { limit: number; nextCursor: string | null } }>(res);
    expect(body.data).toHaveLength(1);
    expect(body.meta.limit).toBe(20);
    expect(body.meta.nextCursor).toBeNull();
  });

  test("rejects an out-of-range limit with 400", async () => {
    const res = await handlers.list({
      req: listRequest(`workspaceId=${workspaceId}&limit=500`),
      ctx: makeCtx(),
    });
    expect(res.status).toBe(400);
    expect(service.listWorkflows).not.toHaveBeenCalled();
  });

  test("returns the denial response when access is missing", async () => {
    const ctx = makeCtx({ authorize: vi.fn().mockResolvedValue(deniedResponse()) });
    const res = await handlers.list({ req: listRequest(`workspaceId=${workspaceId}`), ctx });
    expect(res.status).toBe(403);
    expect(service.listWorkflows).not.toHaveBeenCalled();
  });
});

describe("patch", () => {
  const patchRequest = (body: unknown): Request =>
    new Request("http://localhost/api/v3/workflows/x", {
      method: "PATCH",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    });

  test("updates name on a draft workflow and returns 200", async () => {
    service.getWorkflowById.mockResolvedValue(makeRow({ status: "draft" }));
    service.updateWorkflow.mockResolvedValue(makeRow({ name: "Renamed" }));

    const res = await handlers.patch({
      req: patchRequest({ name: "Renamed" }),
      ctx: makeCtx(),
      params: { workflowId },
    });

    expect(res.status).toBe(200);
    expect(service.updateWorkflow).toHaveBeenCalledWith({ workflowId, workspaceId }, { name: "Renamed" });
  });

  test("allows name/description edits on an enabled workflow", async () => {
    service.getWorkflowById.mockResolvedValue(makeRow({ status: "enabled" }));
    service.updateWorkflow.mockResolvedValue(makeRow({ status: "enabled", description: "x" }));

    const res = await handlers.patch({
      req: patchRequest({ description: "x" }),
      ctx: makeCtx(),
      params: { workflowId },
    });

    expect(res.status).toBe(200);
    expect(service.updateWorkflow).toHaveBeenCalled();
  });

  test("rejects a definition edit on an enabled workflow with 422", async () => {
    service.getWorkflowById.mockResolvedValue(makeRow({ status: "enabled" }));

    const res = await handlers.patch({
      req: patchRequest({ definition }),
      ctx: makeCtx(),
      params: { workflowId },
    });

    expect(res.status).toBe(422);
    const body = await readJson<{ code: string }>(res);
    expect(body.code).toBe("invalid_workflow_state");
    expect(service.updateWorkflow).not.toHaveBeenCalled();
  });

  test("rejects any patch on an archived workflow with 422", async () => {
    service.getWorkflowById.mockResolvedValue(makeRow({ status: "archived" }));

    const res = await handlers.patch({
      req: patchRequest({ name: "x" }),
      ctx: makeCtx(),
      params: { workflowId },
    });

    expect(res.status).toBe(422);
    expect(service.updateWorkflow).not.toHaveBeenCalled();
  });

  test("rejects an empty patch with 400", async () => {
    service.getWorkflowById.mockResolvedValue(makeRow({ status: "draft" }));

    const res = await handlers.patch({ req: patchRequest({}), ctx: makeCtx(), params: { workflowId } });

    expect(res.status).toBe(400);
    expect(service.updateWorkflow).not.toHaveBeenCalled();
  });

  test("returns 403 for an unknown workflow", async () => {
    service.getWorkflowById.mockResolvedValue(null);

    const res = await handlers.patch({
      req: patchRequest({ name: "x" }),
      ctx: makeCtx(),
      params: { workflowId },
    });

    expect(res.status).toBe(403);
    expect(service.updateWorkflow).not.toHaveBeenCalled();
  });
});

describe("duplicate", () => {
  const emptyPost = (): Request =>
    new Request("http://localhost/api/v3/workflows/x/duplicate", { method: "POST" });

  test("creates a copy and returns 201 with a Location header", async () => {
    service.getWorkflowById.mockResolvedValue(makeRow());
    service.duplicateWorkflow.mockResolvedValue(makeRow());

    const res = await handlers.duplicate({ req: emptyPost(), ctx: makeCtx(), params: { workflowId } });

    expect(res.status).toBe(201);
    expect(res.headers.get("Location")).toBe(`/api/v3/workflows/${workflowId}`);
    expect(service.duplicateWorkflow).toHaveBeenCalledWith(expect.objectContaining({ id: workflowId }), {
      name: undefined,
      createdBy: "cm9zr52kh000508l8e3q7bw9j",
    });
  });
});

describe("delete", () => {
  test("hard-deletes and returns 204", async () => {
    service.getWorkflowById.mockResolvedValue(makeRow());
    service.deleteWorkflow.mockResolvedValue(undefined);

    const res = await handlers.delete({ ctx: makeCtx(), params: { workflowId } });

    expect(res.status).toBe(204);
    expect(service.deleteWorkflow).toHaveBeenCalledWith({ workflowId, workspaceId });
  });

  test("returns 403 for an unknown workflow without deleting", async () => {
    service.getWorkflowById.mockResolvedValue(null);

    const res = await handlers.delete({ ctx: makeCtx(), params: { workflowId } });

    expect(res.status).toBe(403);
    expect(service.deleteWorkflow).not.toHaveBeenCalled();
  });
});

describe("archive / unarchive", () => {
  test("archives a draft workflow", async () => {
    service.getWorkflowById.mockResolvedValue(makeRow({ status: "draft" }));
    service.setStatus.mockResolvedValue(makeRow({ status: "archived" }));

    const res = await handlers.archive({ ctx: makeCtx(), params: { workflowId } });

    expect(res.status).toBe(200);
    expect(service.setStatus).toHaveBeenCalledWith({ workflowId, workspaceId }, "archived");
  });

  test("rejects archiving an already-archived workflow with 422", async () => {
    service.getWorkflowById.mockResolvedValue(makeRow({ status: "archived" }));

    const res = await handlers.archive({ ctx: makeCtx(), params: { workflowId } });

    expect(res.status).toBe(422);
    expect(service.setStatus).not.toHaveBeenCalled();
  });

  test("unarchives an archived workflow back to draft", async () => {
    service.getWorkflowById.mockResolvedValue(makeRow({ status: "archived" }));
    service.setStatus.mockResolvedValue(makeRow({ status: "draft" }));

    const res = await handlers.unarchive({ ctx: makeCtx(), params: { workflowId } });

    expect(res.status).toBe(200);
    expect(service.setStatus).toHaveBeenCalledWith({ workflowId, workspaceId }, "draft");
  });

  test("rejects unarchiving a non-archived workflow with 422", async () => {
    service.getWorkflowById.mockResolvedValue(makeRow({ status: "draft" }));

    const res = await handlers.unarchive({ ctx: makeCtx(), params: { workflowId } });

    expect(res.status).toBe(422);
    expect(service.setStatus).not.toHaveBeenCalled();
  });
});

describe("enable", () => {
  test("snapshots a version and returns 200 when enabling a draft", async () => {
    service.getWorkflowById.mockResolvedValue(makeRow({ status: "draft" }));
    service.enableWorkflow.mockResolvedValue(makeRow({ status: "enabled" }));

    const res = await handlers.enable({ ctx: makeCtx(), params: { workflowId } });

    expect(res.status).toBe(200);
    expect(verifyTriggerSurvey).toHaveBeenCalledWith({ workspaceId, surveyId, endingCardIds: [] });
    expect(service.enableWorkflow).toHaveBeenCalledWith(
      { workflowId, workspaceId },
      expect.objectContaining({ publishedBy: "cm9zr52kh000508l8e3q7bw9j" })
    );
    const body = await readJson<{ data: { status: string } }>(res);
    expect(body.data.status).toBe("enabled");
  });

  test("re-enables a disabled workflow", async () => {
    service.getWorkflowById.mockResolvedValue(makeRow({ status: "disabled" }));
    service.enableWorkflow.mockResolvedValue(makeRow({ status: "enabled" }));

    const res = await handlers.enable({ ctx: makeCtx(), params: { workflowId } });

    expect(res.status).toBe(200);
    expect(service.enableWorkflow).toHaveBeenCalled();
  });

  test("records a null publishedBy for API-key callers", async () => {
    service.getWorkflowById.mockResolvedValue(makeRow({ status: "draft" }));
    service.enableWorkflow.mockResolvedValue(makeRow({ status: "enabled" }));

    await handlers.enable({ ctx: makeCtx({ userId: null }), params: { workflowId } });

    expect(service.enableWorkflow.mock.calls[0][1].publishedBy).toBeNull();
  });

  test("rejects enabling an already-enabled workflow with 422 invalid_workflow_state", async () => {
    service.getWorkflowById.mockResolvedValue(makeRow({ status: "enabled" }));

    const res = await handlers.enable({ ctx: makeCtx(), params: { workflowId } });

    expect(res.status).toBe(422);
    const body = await readJson<{ code: string }>(res);
    expect(body.code).toBe("invalid_workflow_state");
    expect(service.enableWorkflow).not.toHaveBeenCalled();
  });

  test("rejects enabling an archived workflow with 422 invalid_workflow_state", async () => {
    service.getWorkflowById.mockResolvedValue(makeRow({ status: "archived" }));

    const res = await handlers.enable({ ctx: makeCtx(), params: { workflowId } });

    expect(res.status).toBe(422);
    const body = await readJson<{ code: string }>(res);
    expect(body.code).toBe("invalid_workflow_state");
    expect(service.enableWorkflow).not.toHaveBeenCalled();
  });

  test("rejects a non-executable (trigger-only) definition with 422 workflow_not_executable", async () => {
    service.getWorkflowById.mockResolvedValue(
      makeRow({ status: "draft", definition: { ...definition, nodes: [], edges: [] } })
    );

    const res = await handlers.enable({ ctx: makeCtx(), params: { workflowId } });

    expect(res.status).toBe(422);
    const body = await readJson<{ code: string; invalid_params: unknown[] }>(res);
    expect(body.code).toBe("workflow_not_executable");
    expect(Array.isArray(body.invalid_params)).toBe(true);
    expect(body.invalid_params.length).toBeGreaterThan(0);
    expect(verifyTriggerSurvey).not.toHaveBeenCalled();
    expect(service.enableWorkflow).not.toHaveBeenCalled();
  });

  test("rejects a missing trigger survey with 422 workflow_not_executable", async () => {
    service.getWorkflowById.mockResolvedValue(makeRow({ status: "draft" }));
    verifyTriggerSurvey.mockResolvedValue({ surveyExists: false, missingEndingCardIds: [] });

    const res = await handlers.enable({ ctx: makeCtx(), params: { workflowId } });

    expect(res.status).toBe(422);
    const body = await readJson<{ code: string; invalid_params: { name: string }[] }>(res);
    expect(body.code).toBe("workflow_not_executable");
    expect(body.invalid_params.map((p) => p.name)).toContain("definition.trigger.config.surveyId");
    expect(service.enableWorkflow).not.toHaveBeenCalled();
  });

  test("rejects a missing ending card with 422 workflow_not_executable", async () => {
    service.getWorkflowById.mockResolvedValue(makeRow({ status: "draft" }));
    verifyTriggerSurvey.mockResolvedValue({ surveyExists: true, missingEndingCardIds: ["ec_missing"] });

    const res = await handlers.enable({ ctx: makeCtx(), params: { workflowId } });

    expect(res.status).toBe(422);
    const body = await readJson<{ code: string; invalid_params: { name: string }[] }>(res);
    expect(body.code).toBe("workflow_not_executable");
    expect(body.invalid_params.map((p) => p.name)).toContain("definition.trigger.config.endingCardIds");
    expect(service.enableWorkflow).not.toHaveBeenCalled();
  });

  test("maps a concurrent-enable conflict from the service to 409", async () => {
    service.getWorkflowById.mockResolvedValue(makeRow({ status: "draft" }));
    service.enableWorkflow.mockRejectedValue(new WorkflowConflictError());

    const res = await handlers.enable({ ctx: makeCtx(), params: { workflowId } });

    expect(res.status).toBe(409);
    const body = await readJson<{ code: string }>(res);
    expect(body.code).toBe("conflict");
  });

  test("returns 403 for an unknown workflow without enabling", async () => {
    service.getWorkflowById.mockResolvedValue(null);

    const res = await handlers.enable({ ctx: makeCtx(), params: { workflowId } });

    expect(res.status).toBe(403);
    expect(service.enableWorkflow).not.toHaveBeenCalled();
  });
});

describe("disable", () => {
  test("disables an enabled workflow and returns 200", async () => {
    service.getWorkflowById.mockResolvedValue(makeRow({ status: "enabled" }));
    service.disableWorkflow.mockResolvedValue(makeRow({ status: "disabled" }));

    const res = await handlers.disable({ ctx: makeCtx(), params: { workflowId } });

    expect(res.status).toBe(200);
    expect(service.disableWorkflow).toHaveBeenCalledWith({ workflowId, workspaceId });
    const body = await readJson<{ data: { status: string } }>(res);
    expect(body.data.status).toBe("disabled");
  });

  test("rejects disabling a draft workflow with 422 invalid_workflow_state", async () => {
    service.getWorkflowById.mockResolvedValue(makeRow({ status: "draft" }));

    const res = await handlers.disable({ ctx: makeCtx(), params: { workflowId } });

    expect(res.status).toBe(422);
    const body = await readJson<{ code: string }>(res);
    expect(body.code).toBe("invalid_workflow_state");
    expect(service.disableWorkflow).not.toHaveBeenCalled();
  });

  test("returns 403 for an unknown workflow without disabling", async () => {
    service.getWorkflowById.mockResolvedValue(null);

    const res = await handlers.disable({ ctx: makeCtx(), params: { workflowId } });

    expect(res.status).toBe(403);
    expect(service.disableWorkflow).not.toHaveBeenCalled();
  });
});

const runId = "cm9zr4w9d000308l8c5n8xk7e";

const makeRunRow = (overrides: Partial<WorkflowRunRow> = {}): WorkflowRunRow => ({
  id: runId,
  createdAt: new Date("2026-06-12T10:00:00.000Z"),
  updatedAt: new Date("2026-06-12T10:01:00.000Z"),
  workflowId,
  workspaceId,
  workflowVersionId: null,
  responseId: null,
  status: "completed",
  triggerType: "response.completed",
  surveyId,
  isDryRun: false,
  attempt: 0,
  error: null,
  startedAt: new Date("2026-06-12T10:00:30.000Z"),
  finishedAt: new Date("2026-06-12T10:01:00.000Z"),
  ...overrides,
});

// Mirrors the canonical run-data fixture's trigger payload (a valid TWorkflowTriggerRunPayload), so
// the handler's output validation against ZWorkflowRunResource passes.
const validTriggerPayload = {
  type: "response.completed",
  surveyId,
  responseId: "cm9zr4rsp000708l8bqccpfrx",
  endingCardId: "cm9zr4q7i000108l84gozfggr",
  workspaceId,
  data: { response: { email: "jane@example.com", score: 9 } },
  triggeredAt: "2026-06-09T12:01:00.000Z",
} as unknown as TWorkflowTriggerRunPayload;

const makeRunDetail = (overrides: Partial<WorkflowRunWithLogsRow> = {}): WorkflowRunWithLogsRow => ({
  ...makeRunRow(),
  triggerPayload: validTriggerPayload,
  data: { steps: [] },
  idempotencyKey: null,
  nextAttemptAt: null,
  lastErrorAt: null,
  logs: [
    {
      id: "cm9zr5log0000000000000000a",
      runId,
      sequence: 0,
      stepId: "send-email",
      stepType: "send_email",
      status: "succeeded",
      input: { to: "jane@example.com" },
      output: { messageId: "msg_1" },
      error: null,
      startedAt: new Date("2026-06-12T10:00:30.000Z"),
      finishedAt: new Date("2026-06-12T10:00:31.000Z"),
    },
  ],
  ...overrides,
});

describe("listRuns", () => {
  const runsRequest = (query: string): Request =>
    new Request(`http://localhost/api/v3/workflows/runs?${query}`);

  test("returns 200 with a cursor-paginated envelope of run summaries", async () => {
    service.listWorkflowRuns.mockResolvedValue({ runs: [makeRunRow()], nextCursor: null });

    const res = await handlers.listRuns({ req: runsRequest(`workspaceId=${workspaceId}`), ctx: makeCtx() });

    expect(res.status).toBe(200);
    const body = await readJson<{
      data: { id: string }[];
      meta: { limit: number; nextCursor: string | null };
    }>(res);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].id).toBe(runId);
    expect(body.meta.limit).toBe(20);
    expect(body.meta.nextCursor).toBeNull();
    expect(authorizeAllow).toHaveBeenCalledWith(workspaceId, "read");
  });

  test("forwards workflowId / responseId / status / isDryRun filters to the service", async () => {
    service.listWorkflowRuns.mockResolvedValue({ runs: [], nextCursor: null });

    await handlers.listRuns({
      req: runsRequest(
        `workspaceId=${workspaceId}&workflowId=${workflowId}&responseId=${responseId}&filter[status][in]=failed,completed&filter[isDryRun][eq]=true`
      ),
      ctx: makeCtx(),
    });

    expect(service.listWorkflowRuns).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId,
        workflowId,
        responseId,
        statusIn: ["failed", "completed"],
        isDryRun: true,
      })
    );
  });

  test("forwards isDryRun=false alongside a status filter (falsy boolean not dropped)", async () => {
    service.listWorkflowRuns.mockResolvedValue({ runs: [], nextCursor: null });

    await handlers.listRuns({
      req: runsRequest(`workspaceId=${workspaceId}&filter[isDryRun][eq]=false&filter[status][in]=failed`),
      ctx: makeCtx(),
    });

    expect(service.listWorkflowRuns).toHaveBeenCalledWith(
      expect.objectContaining({ workspaceId, isDryRun: false, statusIn: ["failed"] })
    );
  });

  test("returns an empty data array and null nextCursor for an empty page", async () => {
    service.listWorkflowRuns.mockResolvedValue({ runs: [], nextCursor: null });

    const res = await handlers.listRuns({ req: runsRequest(`workspaceId=${workspaceId}`), ctx: makeCtx() });

    expect(res.status).toBe(200);
    const body = await readJson<{ data: unknown[]; meta: { nextCursor: string | null } }>(res);
    expect(body.data).toEqual([]);
    expect(body.meta.nextCursor).toBeNull();
  });

  test("maps a WorkflowInvalidInputError from the service (e.g. malformed cursor) to 400", async () => {
    service.listWorkflowRuns.mockRejectedValue(new WorkflowInvalidInputError("malformed cursor"));

    const res = await handlers.listRuns({
      req: runsRequest(`workspaceId=${workspaceId}&cursor=not-base64url-json`),
      ctx: makeCtx(),
    });

    expect(res.status).toBe(400);
    const body = await readJson<{ code: string }>(res);
    expect(body.code).toBe("bad_request");
  });

  test("rejects a missing workspaceId with 400 and never calls the service", async () => {
    const res = await handlers.listRuns({ req: runsRequest("limit=20"), ctx: makeCtx() });

    expect(res.status).toBe(400);
    expect(service.listWorkflowRuns).not.toHaveBeenCalled();
  });

  test("rejects an out-of-range limit with 400", async () => {
    const res = await handlers.listRuns({
      req: runsRequest(`workspaceId=${workspaceId}&limit=500`),
      ctx: makeCtx(),
    });

    expect(res.status).toBe(400);
    expect(service.listWorkflowRuns).not.toHaveBeenCalled();
  });

  test("rejects limit below the minimum (limit=0) with 400", async () => {
    const res = await handlers.listRuns({
      req: runsRequest(`workspaceId=${workspaceId}&limit=0`),
      ctx: makeCtx(),
    });

    expect(res.status).toBe(400);
    expect(service.listWorkflowRuns).not.toHaveBeenCalled();
  });

  test("accepts the minimum limit (limit=1)", async () => {
    service.listWorkflowRuns.mockResolvedValue({ runs: [makeRunRow()], nextCursor: null });

    const res = await handlers.listRuns({
      req: runsRequest(`workspaceId=${workspaceId}&limit=1`),
      ctx: makeCtx(),
    });

    expect(res.status).toBe(200);
    expect(service.listWorkflowRuns).toHaveBeenCalledWith(expect.objectContaining({ limit: 1 }));
  });

  test("returns the authorize denial (403) and never calls the service", async () => {
    authorizeAllow.mockResolvedValue(deniedResponse());

    const res = await handlers.listRuns({ req: runsRequest(`workspaceId=${workspaceId}`), ctx: makeCtx() });

    expect(res.status).toBe(403);
    expect(service.listWorkflowRuns).not.toHaveBeenCalled();
  });
});

describe("getRun", () => {
  test("returns 200 with the full run resource including ordered logs", async () => {
    service.getWorkflowRun.mockResolvedValue(makeRunDetail());

    const res = await handlers.getRun({ ctx: makeCtx(), params: { runId } });

    expect(res.status).toBe(200);
    const body = await readJson<{ data: { id: string; logs: { id: string }[]; triggerPayload: unknown } }>(
      res
    );
    expect(body.data.id).toBe(runId);
    expect(body.data.logs).toHaveLength(1);
    expect(body.data.triggerPayload).toMatchObject({ type: "response.completed", surveyId });
    expect(authorizeAllow).toHaveBeenCalledWith(workspaceId, "read");
  });

  test("returns 403 (not 404) when the run does not exist, without authorizing", async () => {
    service.getWorkflowRun.mockResolvedValue(null);

    const res = await handlers.getRun({ ctx: makeCtx(), params: { runId } });

    expect(res.status).toBe(403);
    expect(authorizeAllow).not.toHaveBeenCalled();
    const body = await readJson<{ code: string }>(res);
    expect(body.code).toBe("forbidden");
  });

  test("authorizes against the loaded run's workspace and returns its denial on mismatch", async () => {
    service.getWorkflowRun.mockResolvedValue(makeRunDetail({ workspaceId: "cm9zr4other00000000000000x" }));
    authorizeAllow.mockResolvedValue(deniedResponse());

    const res = await handlers.getRun({ ctx: makeCtx(), params: { runId } });

    expect(res.status).toBe(403);
    expect(authorizeAllow).toHaveBeenCalledWith("cm9zr4other00000000000000x", "read");
    const body = await readJson<{ code: string }>(res);
    expect(body.code).toBe("forbidden");
  });
});
