import { beforeEach, describe, expect, test, vi } from "vitest";
import type { WorkflowRowWithLastRun, WorkflowsLogger } from "../services/ports";
import type { WorkflowsService } from "../services/workflows.service";
import type { AuthorizedWorkspace, WorkflowApiContext } from "./context";
import { createWorkflowsHandlers } from "./workflows.handlers";

const surveyId = "cm9zr4q7i000108l84gozfggr";
const workspaceId = "cm9zr4mps000008l8btfy1vtz";
const workflowId = "cm9zr4t2b000208l8h2m1aq3c";

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
  definition,
  runs: [],
  ...overrides,
});

const service = {
  listWorkflows: vi.fn<WorkflowsService["listWorkflows"]>(),
  createWorkflow: vi.fn<WorkflowsService["createWorkflow"]>(),
  getWorkflowById: vi.fn<WorkflowsService["getWorkflowById"]>(),
};
const handlers = createWorkflowsHandlers(service);

const readJson = async <T>(res: Response): Promise<T> => (await res.json()) as T;

const authorizeAllow = vi.fn<WorkflowApiContext["authorize"]>();
const logger: WorkflowsLogger = { warn: vi.fn(), error: vi.fn() };

const authorized: AuthorizedWorkspace = { workspaceId, organizationId: "cm9zr5org00000000000000000" };

const makeCtx = (overrides: Partial<WorkflowApiContext> = {}): WorkflowApiContext => ({
  userId: "cm9zr52kh000508l8e3q7bw9j",
  requestId: "req_1",
  instance: "https://app.formbricks.com",
  logger,
  authorize: authorizeAllow,
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
});

describe("get", () => {
  test("returns 403 (not 404) when the workflow does not exist", async () => {
    service.getWorkflowById.mockResolvedValue(null);

    const res = await handlers.get(makeCtx(), { workflowId });

    expect(res.status).toBe(403);
    expect(authorizeAllow).not.toHaveBeenCalled();
    const body = await readJson<{ code: string }>(res);
    expect(body.code).toBe("forbidden");
  });

  test("returns the denial response when the caller lacks workspace access", async () => {
    service.getWorkflowById.mockResolvedValue(makeRow());
    const ctx = makeCtx({ authorize: vi.fn().mockResolvedValue(deniedResponse()) });

    const res = await handlers.get(ctx, { workflowId });

    expect(res.status).toBe(403);
  });

  test("returns 200 with the workflow resource on success", async () => {
    service.getWorkflowById.mockResolvedValue(makeRow());

    const res = await handlers.get(makeCtx(), { workflowId });

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

    const res = await handlers.get(makeCtx(), { workflowId });

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

    const res = await handlers.create(
      postRequest({ workspaceId, name: "Notify team", definition }),
      makeCtx()
    );

    expect(res.status).toBe(201);
    expect(res.headers.get("Location")).toBe(`/api/v3/workflows/${workflowId}`);
    expect(service.createWorkflow).toHaveBeenCalledWith(expect.objectContaining({ workspaceId }), {
      createdBy: "cm9zr52kh000508l8e3q7bw9j",
    });
  });

  test("rejects an invalid definition with 400 and invalid_params", async () => {
    const res = await handlers.create(
      postRequest({
        workspaceId,
        name: "Broken",
        definition: { schemaVersion: 1, trigger: {}, nodes: [], edges: [], entryNodeId: "trigger" },
      }),
      makeCtx()
    );

    expect(res.status).toBe(400);
    const body = await readJson<{ code: string; invalid_params: unknown }>(res);
    expect(body.code).toBe("bad_request");
    expect(Array.isArray(body.invalid_params)).toBe(true);
    expect(service.createWorkflow).not.toHaveBeenCalled();
  });

  test("returns the denial response without creating when access is missing", async () => {
    const ctx = makeCtx({ authorize: vi.fn().mockResolvedValue(deniedResponse()) });

    const res = await handlers.create(postRequest({ workspaceId, name: "Notify team", definition }), ctx);

    expect(res.status).toBe(403);
    expect(service.createWorkflow).not.toHaveBeenCalled();
  });

  test("rejects a malformed JSON body with 400", async () => {
    const req = new Request("http://localhost/api/v3/workflows", {
      method: "POST",
      body: "{ not valid json",
      headers: { "Content-Type": "application/json" },
    });

    const res = await handlers.create(req, makeCtx());

    expect(res.status).toBe(400);
    expect(service.createWorkflow).not.toHaveBeenCalled();
  });

  test("rejects a body that exceeds the size limit with 400", async () => {
    const oversizedName = "x".repeat(2 * 1024 * 1024 + 1);

    const res = await handlers.create(
      postRequest({ workspaceId, name: oversizedName, definition }),
      makeCtx()
    );

    expect(res.status).toBe(400);
    expect(service.createWorkflow).not.toHaveBeenCalled();
  });
});

describe("list", () => {
  const listRequest = (query: string): Request => new Request(`http://localhost/api/v3/workflows?${query}`);

  test("returns 200 with a cursor-paginated envelope", async () => {
    service.listWorkflows.mockResolvedValue({ workflows: [makeRow()], nextCursor: null });

    const res = await handlers.list(listRequest(`workspaceId=${workspaceId}&sortBy=name`), makeCtx());

    expect(res.status).toBe(200);
    const body = await readJson<{ data: unknown[]; meta: { limit: number; nextCursor: string | null } }>(res);
    expect(body.data).toHaveLength(1);
    expect(body.meta.limit).toBe(20);
    expect(body.meta.nextCursor).toBeNull();
  });

  test("rejects an out-of-range limit with 400", async () => {
    const res = await handlers.list(listRequest(`workspaceId=${workspaceId}&limit=500`), makeCtx());
    expect(res.status).toBe(400);
    expect(service.listWorkflows).not.toHaveBeenCalled();
  });

  test("returns the denial response when access is missing", async () => {
    const ctx = makeCtx({ authorize: vi.fn().mockResolvedValue(deniedResponse()) });
    const res = await handlers.list(listRequest(`workspaceId=${workspaceId}`), ctx);
    expect(res.status).toBe(403);
    expect(service.listWorkflows).not.toHaveBeenCalled();
  });
});
