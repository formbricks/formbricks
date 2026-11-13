import { beforeEach, describe, expect, test, vi } from "vitest";
import type { WorkflowRowWithLastRun, WorkflowSampleRow, WorkflowsLogger } from "../services/ports";
import type { WorkflowsService } from "../services/workflows.service";
import { WEBHOOK_PAYLOAD_MAX_BYTES } from "../webhook/limits";
import type { AuthorizedWorkspace, WorkflowApiContext } from "./context";
import { createWorkflowsHandlers } from "./workflows.handlers";

const workspaceId = "cm9zr4mps000008l8btfy1vtz";
const workflowId = "cm9zr4t2b000208l8h2m1aq3c";
const surveyId = "cm9zr4q7i000108l84gozfggr";
const token = "s3cretT0kenValue_abcdefg";

const webhookDefinition = {
  schemaVersion: 1 as const,
  trigger: { id: "trigger", type: "trigger" as const, triggerType: "webhook" as const, config: {} },
  nodes: [
    {
      id: "send-email",
      type: "action" as const,
      actionType: "send_email" as const,
      config: {
        from: "noreply@example.com",
        to: "support@example.com",
        replyTo: [],
        subject: "New order",
        body: "An order came in.",
        attachResponseData: false,
      },
    },
  ],
  edges: [{ id: "e1", source: "trigger", target: "send-email" }],
  entryNodeId: "trigger",
};

const surveyDefinition = {
  ...webhookDefinition,
  trigger: {
    id: "trigger",
    type: "trigger" as const,
    triggerType: "response.completed" as const,
    config: { surveyId, endingCardIds: [] },
  },
};

const makeRow = (overrides: Partial<WorkflowRowWithLastRun> = {}): WorkflowRowWithLastRun => ({
  id: workflowId,
  createdAt: new Date("2026-11-01T09:30:00.000Z"),
  updatedAt: new Date("2026-11-02T09:30:00.000Z"),
  name: "Orders",
  description: null,
  status: "draft",
  workspaceId,
  createdBy: null,
  creator: null,
  definition: webhookDefinition,
  webhookTokenHash: "stored-hash",
  webhookTokenEncrypted: "stored-encrypted",
  runs: [],
  _count: { runs: 0 },
  ...overrides,
});

const makeSample = (overrides: Partial<WorkflowSampleRow> = {}): WorkflowSampleRow => ({
  workflowId,
  workspaceId,
  source: "trigger",
  sample: { order: { id: 7, items: [] } },
  lastCalledAt: new Date("2026-11-03T10:00:00.000Z"),
  lastCallerIp: "203.0.113.9",
  updatedAt: new Date("2026-11-03T10:00:00.000Z"),
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
  regenerateWebhookToken: vi.fn<WorkflowsService["regenerateWebhookToken"]>(),
  revealWebhookToken: vi.fn<WorkflowsService["revealWebhookToken"]>(),
  getTriggerSample: vi.fn<WorkflowsService["getTriggerSample"]>(),
  setTriggerSample: vi.fn<WorkflowsService["setTriggerSample"]>(),
};
const handlers = createWorkflowsHandlers(service);

const authorize = vi.fn<WorkflowApiContext["authorize"]>();
const verifyTriggerSurvey = vi.fn<WorkflowApiContext["verifyTriggerSurvey"]>();
const recordAudit = vi.fn<NonNullable<WorkflowApiContext["recordAudit"]>>();
const logger: WorkflowsLogger = { warn: vi.fn(), error: vi.fn() };
const authorized: AuthorizedWorkspace = { workspaceId, organizationId: "cm9zr5org00000000000000000" };

const makeCtx = (overrides: Partial<WorkflowApiContext> = {}): WorkflowApiContext => ({
  userId: "cm9zr52kh000508l8e3q7bw9j",
  requestId: "req_1",
  logger,
  webhookBaseUrl: "https://app.example.com",
  authorize,
  verifyTriggerSurvey,
  verifyRecipientsAllowed: vi.fn().mockResolvedValue({ disallowedEmails: [] }),
  listUnreadableSurveyIds: vi.fn().mockResolvedValue([]),
  recordAudit,
  ...overrides,
});

const denied = (): Response =>
  Response.json({ status: 403, code: "forbidden" }, { status: 403, headers: { "X-Request-Id": "req_1" } });

const jsonRequest = (method: string, body: unknown): Request =>
  new Request(`http://localhost/api/v3/workflows/${workflowId}`, {
    method,
    body: typeof body === "string" ? body : JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });

const readJson = async <T>(res: Response): Promise<T> => (await res.json()) as T;

beforeEach(() => {
  vi.clearAllMocks();
  authorize.mockResolvedValue(authorized);
  verifyTriggerSurvey.mockResolvedValue({ surveyExists: true, missingEndingCardIds: [] });
  service.getWorkflowById.mockResolvedValue(makeRow());
  service.revealWebhookToken.mockReturnValue(token);
  service.getTriggerSample.mockResolvedValue(makeSample());
});

describe("a Webhook workflow through the existing operations", () => {
  test("is enabled without looking for a survey", async () => {
    service.enableWorkflow.mockResolvedValue(makeRow({ status: "enabled" }));

    const res = await handlers.enable({ ctx: makeCtx(), params: { workflowId } });

    expect(res.status).toBe(200);
    expect(verifyTriggerSurvey).not.toHaveBeenCalled();
  });

  test("passes a dry run without looking for a survey", async () => {
    const res = await handlers.testWorkflow({ ctx: makeCtx(), params: { workflowId } });

    expect(res.status).toBe(200);
    expect((await readJson<{ data: { ok: boolean } }>(res)).data.ok).toBe(true);
    expect(verifyTriggerSurvey).not.toHaveBeenCalled();
  });

  test("is read with the webhook trigger type and no survey", async () => {
    const res = await handlers.get({ ctx: makeCtx(), params: { workflowId } });

    const body = await readJson<{ data: Record<string, unknown> }>(res);
    expect(body.data).toMatchObject({ triggerType: "webhook", surveyId: null });
    expect(JSON.stringify(body)).not.toContain("stored-hash");
    expect(JSON.stringify(body)).not.toContain("stored-encrypted");
  });

  test("asks for a token when a draft first switches to a Webhook trigger", async () => {
    service.getWorkflowById.mockResolvedValue(
      makeRow({ definition: surveyDefinition, webhookTokenHash: null, webhookTokenEncrypted: null })
    );
    service.updateWorkflow.mockResolvedValue(makeRow());

    await handlers.patch({
      req: jsonRequest("PATCH", { definition: webhookDefinition }),
      ctx: makeCtx(),
      params: { workflowId },
    });

    expect(service.updateWorkflow.mock.calls[0][1]).toMatchObject({ issueWebhookToken: true });
  });

  test("keeps its token when a Webhook draft is saved again", async () => {
    service.updateWorkflow.mockResolvedValue(makeRow());

    await handlers.patch({
      req: jsonRequest("PATCH", { definition: webhookDefinition }),
      ctx: makeCtx(),
      params: { workflowId },
    });

    expect(service.updateWorkflow.mock.calls[0][1]).toMatchObject({ issueWebhookToken: false });
  });
});

describe("getWebhook", () => {
  test("needs write access, so read-only members never see the Secret URL", async () => {
    authorize.mockResolvedValue(denied());

    const res = await handlers.getWebhook({ ctx: makeCtx(), params: { workflowId } });

    expect(res.status).toBe(403);
    expect(authorize).toHaveBeenCalledWith(workspaceId, "readWrite");
    expect(service.revealWebhookToken).not.toHaveBeenCalled();
  });

  test("answers 403, not 404, for an unknown workflow", async () => {
    service.getWorkflowById.mockResolvedValue(null);

    const res = await handlers.getWebhook({ ctx: makeCtx(), params: { workflowId } });

    expect(res.status).toBe(403);
  });

  test("returns the Secret URL, the last call and the sample with its Variables", async () => {
    const res = await handlers.getWebhook({ ctx: makeCtx(), params: { workflowId } });

    expect(res.status).toBe(200);
    const body = await readJson<{ data: Record<string, unknown> }>(res);
    expect(body.data).toEqual({
      workflowId,
      url: `https://app.example.com/api/v3/workflows/${workflowId}/webhook/${token}`,
      lastCalledAt: "2026-11-03T10:00:00.000Z",
      lastCallerIp: "203.0.113.9",
      sample: {
        workflowId,
        source: "trigger",
        payload: { order: { id: 7, items: [] } },
        variables: {
          variables: [
            { path: "payload.order", valueType: "object" },
            { path: "payload.order.id", valueType: "number" },
          ],
          notSupported: [{ path: "payload.order.items", reason: "list" }],
          truncated: false,
        },
        updatedAt: "2026-11-03T10:00:00.000Z",
      },
    });
  });

  test("returns a null sample before any call or paste", async () => {
    service.getTriggerSample.mockResolvedValue(null);

    const res = await handlers.getWebhook({ ctx: makeCtx(), params: { workflowId } });

    expect((await readJson<{ data: Record<string, unknown> }>(res)).data).toMatchObject({
      lastCalledAt: null,
      lastCallerIp: null,
      sample: null,
    });
  });

  test("refuses a workflow whose trigger is not a Webhook trigger", async () => {
    service.getWorkflowById.mockResolvedValue(makeRow({ definition: surveyDefinition }));

    const res = await handlers.getWebhook({ ctx: makeCtx(), params: { workflowId } });

    expect(res.status).toBe(422);
    expect(service.revealWebhookToken).not.toHaveBeenCalled();
  });
});

describe("regenerateWebhook", () => {
  test("issues a new token and returns the new Secret URL", async () => {
    service.regenerateWebhookToken.mockResolvedValue(makeRow({ webhookTokenEncrypted: "new-encrypted" }));
    service.revealWebhookToken.mockReturnValue("n3wT0ken");

    const res = await handlers.regenerateWebhook({ ctx: makeCtx(), params: { workflowId } });

    expect(res.status).toBe(200);
    expect(service.regenerateWebhookToken).toHaveBeenCalledWith({ workflowId, workspaceId });
    expect((await readJson<{ data: { url: string } }>(res)).data.url).toBe(
      `https://app.example.com/api/v3/workflows/${workflowId}/webhook/n3wT0ken`
    );
  });

  test("is audited against the workflow without any token material", async () => {
    service.regenerateWebhookToken.mockResolvedValue(makeRow({ webhookTokenHash: "new-hash" }));

    await handlers.regenerateWebhook({ ctx: makeCtx(), params: { workflowId } });

    expect(recordAudit).toHaveBeenCalledTimes(1);
    const detail = recordAudit.mock.calls[0][0];
    expect(detail.targetId).toBe(workflowId);
    const serialized = JSON.stringify(detail);
    for (const secret of [token, "stored-hash", "stored-encrypted", "new-hash"]) {
      expect(serialized).not.toContain(secret);
    }
  });

  test("needs write access", async () => {
    authorize.mockResolvedValue(denied());

    const res = await handlers.regenerateWebhook({ ctx: makeCtx(), params: { workflowId } });

    expect(res.status).toBe(403);
    expect(service.regenerateWebhookToken).not.toHaveBeenCalled();
  });

  test.each([
    ["an archived workflow", makeRow({ status: "archived" })],
    ["a workflow without a Webhook trigger", makeRow({ definition: surveyDefinition })],
  ])("refuses %s", async (_label, row) => {
    service.getWorkflowById.mockResolvedValue(row);

    const res = await handlers.regenerateWebhook({ ctx: makeCtx(), params: { workflowId } });

    expect(res.status).toBe(422);
    expect(service.regenerateWebhookToken).not.toHaveBeenCalled();
  });
});

describe("setSample", () => {
  test("stores the pasted payload and returns its Variables", async () => {
    service.setTriggerSample.mockResolvedValue(makeSample({ sample: { a: { b: "c" } } }));

    const res = await handlers.setSample({
      req: jsonRequest("PUT", { payload: { a: { b: "c" } } }),
      ctx: makeCtx(),
      params: { workflowId },
    });

    expect(res.status).toBe(200);
    expect(service.setTriggerSample).toHaveBeenCalledWith({ workflowId, workspaceId }, { a: { b: "c" } });
    const body = await readJson<{ data: { variables: { variables: unknown[] } } }>(res);
    expect(body.data.variables.variables).toEqual([
      { path: "payload.a", valueType: "object" },
      { path: "payload.a.b", valueType: "string" },
    ]);
  });

  test("answers 413 for a payload over 100 KB", async () => {
    const res = await handlers.setSample({
      req: jsonRequest("PUT", { payload: { text: "x".repeat(WEBHOOK_PAYLOAD_MAX_BYTES) } }),
      ctx: makeCtx(),
      params: { workflowId },
    });

    expect(res.status).toBe(413);
    expect(service.setTriggerSample).not.toHaveBeenCalled();
  });

  test("answers 400 for a payload nested deeper than ten levels, without echoing it", async () => {
    let payload: Record<string, unknown> = { secretLeaf: "do-not-echo" };
    for (let level = 0; level < 11; level++) payload = { child: payload };

    const res = await handlers.setSample({
      req: jsonRequest("PUT", { payload }),
      ctx: makeCtx(),
      params: { workflowId },
    });

    expect(res.status).toBe(400);
    expect(await res.text()).not.toContain("do-not-echo");
    expect(service.setTriggerSample).not.toHaveBeenCalled();
  });

  test("answers 400 for a payload that is not an object", async () => {
    const res = await handlers.setSample({
      req: jsonRequest("PUT", { payload: [1, 2] }),
      ctx: makeCtx(),
      params: { workflowId },
    });

    expect(res.status).toBe(400);
  });

  test("needs write access", async () => {
    authorize.mockResolvedValue(denied());

    const res = await handlers.setSample({
      req: jsonRequest("PUT", { payload: {} }),
      ctx: makeCtx(),
      params: { workflowId },
    });

    expect(res.status).toBe(403);
    expect(authorize).toHaveBeenCalledWith(workspaceId, "readWrite");
  });

  test("refuses an archived workflow", async () => {
    service.getWorkflowById.mockResolvedValue(makeRow({ status: "archived" }));

    const res = await handlers.setSample({
      req: jsonRequest("PUT", { payload: {} }),
      ctx: makeCtx(),
      params: { workflowId },
    });

    expect(res.status).toBe(422);
  });
});
