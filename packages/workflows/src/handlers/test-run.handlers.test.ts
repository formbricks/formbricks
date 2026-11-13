import { beforeEach, describe, expect, test, vi } from "vitest";
import type {
  WorkflowRowWithLastRun,
  WorkflowRunWithLogsRow,
  WorkflowSampleRow,
  WorkflowsLogger,
} from "../services/ports";
import type { WorkflowsService } from "../services/workflows.service";
import type { AuthorizedWorkspace, WorkflowApiContext } from "./context";
import { createWorkflowsHandlers } from "./workflows.handlers";

const workspaceId = "cm9zr4mps000008l8btfy1vtz";
const workflowId = "cm9zr4t2b000208l8h2m1aq3c";
const runId = "cm9zr5run000000000000000a";
const surveyId = "cm9zr4q7i000108l84gozfggr";

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
  runs: [],
  _count: { runs: 0 },
  ...overrides,
});

const makeSample = (sample: Record<string, unknown>): WorkflowSampleRow => ({
  workflowId,
  workspaceId,
  source: "trigger",
  sample,
  lastCalledAt: null,
  lastCallerIp: null,
  updatedAt: new Date("2026-11-03T10:00:00.000Z"),
});

const makeRunDetail = (payload: Record<string, unknown>): WorkflowRunWithLogsRow => ({
  id: runId,
  createdAt: new Date("2026-11-13T10:00:00.000Z"),
  updatedAt: new Date("2026-11-13T10:00:01.000Z"),
  workflowId,
  workspaceId,
  workflowVersionId: null,
  responseId: null,
  status: "completed",
  triggerType: "webhook",
  surveyId: null,
  isDryRun: true,
  attempt: 1,
  error: null,
  startedAt: new Date("2026-11-13T10:00:00.000Z"),
  finishedAt: new Date("2026-11-13T10:00:01.000Z"),
  triggerPayload: { type: "webhook", workspaceId, payload, triggeredAt: "2026-11-13T10:00:00.000Z" },
  data: { steps: [] },
  idempotencyKey: null,
  nextAttemptAt: null,
  lastErrorAt: null,
  callerIp: null,
  contentDeletedAt: null,
  contentRetentionDays: null,
  workflowVersion: null,
  logs: [
    {
      id: "cm9zr5log0000000000000000a",
      runId,
      sequence: 1,
      stepId: "send-email",
      stepType: "send_email",
      status: "succeeded",
      input: { to: "support@example.com", subject: "New order" },
      output: { recipient: "support@example.com" },
      error: null,
      startedAt: new Date("2026-11-13T10:00:00.000Z"),
      finishedAt: new Date("2026-11-13T10:00:01.000Z"),
    },
  ],
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
  createTestRun: vi.fn<WorkflowsService["createTestRun"]>(),
};
const handlers = createWorkflowsHandlers(service);

const authorize = vi.fn<WorkflowApiContext["authorize"]>();
const recordAudit = vi.fn<NonNullable<WorkflowApiContext["recordAudit"]>>();
const runTest = vi.fn<NonNullable<WorkflowApiContext["runTest"]>>();
const logger: WorkflowsLogger = { warn: vi.fn(), error: vi.fn() };
const authorized: AuthorizedWorkspace = { workspaceId, organizationId: "cm9zr5org00000000000000000" };

const makeCtx = (overrides: Partial<WorkflowApiContext> = {}): WorkflowApiContext => ({
  userId: "cm9zr52kh000508l8e3q7bw9j",
  requestId: "req_1",
  logger,
  authorize,
  verifyTriggerSurvey: vi.fn(),
  verifyRecipientsAllowed: vi.fn().mockResolvedValue({ disallowedEmails: [] }),
  listUnreadableSurveyIds: vi.fn().mockResolvedValue([]),
  verifySurveyLinkSurveys: vi.fn().mockResolvedValue([]),
  recordAudit,
  runTest,
  ...overrides,
});

const request = (body?: unknown): Request =>
  new Request(`http://localhost/api/v3/workflows/${workflowId}/test-runs`, {
    method: "POST",
    body: body === undefined ? "" : JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });

const startTestRun = (body?: unknown, ctx = makeCtx()) =>
  handlers.createTestRun({ req: request(body), ctx, params: { workflowId } });

beforeEach(() => {
  vi.clearAllMocks();
  authorize.mockResolvedValue(authorized);
  service.getWorkflowById.mockResolvedValue(makeRow());
  service.getTriggerSample.mockResolvedValue(makeSample({ order: { id: 7 } }));
  service.createTestRun.mockResolvedValue({ id: runId });
  service.getWorkflowRun.mockImplementation(() => {
    const calls = service.createTestRun.mock.calls;
    const trigger = calls.length > 0 ? calls[0][1] : null;
    return Promise.resolve(makeRunDetail(trigger?.type === "webhook" ? trigger.payload : {}));
  });
  runTest.mockResolvedValue(undefined);
});

describe("createTestRun", () => {
  test("runs the draft with the payload from the body and answers 201 with the run", async () => {
    const res = await startTestRun({ payload: { order: { id: 42 } } });

    expect(res.status).toBe(201);
    expect(res.headers.get("Location")).toBe(`/api/v3/workflows/runs/${runId}`);
    expect(service.createTestRun).toHaveBeenCalledWith(
      { workflowId, workspaceId },
      expect.objectContaining({ type: "webhook", workspaceId, payload: { order: { id: 42 } } })
    );
    expect(runTest).toHaveBeenCalledWith({ runId, workflowId, workspaceId });
    const body = (await res.json()) as { data: Record<string, unknown> };
    expect(body.data).toMatchObject({
      id: runId,
      isDryRun: true,
      workflowVersionId: null,
      steps: [{ stepId: "send-email", detail: { kind: "send_email", recipient: "support@example.com" } }],
    });
  });

  test("uses the stored Sample payload when the body has none", async () => {
    await startTestRun({});
    await startTestRun();

    expect(service.createTestRun).toHaveBeenCalledTimes(2);
    for (const call of service.createTestRun.mock.calls) {
      expect(call[1]).toMatchObject({ payload: { order: { id: 7 } } });
    }
  });

  test("refuses a run with no payload and no Sample payload, creating nothing", async () => {
    service.getTriggerSample.mockResolvedValue(null);

    const res = await startTestRun({});

    expect(res.status).toBe(422);
    expect(service.createTestRun).not.toHaveBeenCalled();
  });

  test("needs write access", async () => {
    authorize.mockResolvedValue(Response.json({ code: "forbidden" }, { status: 403 }));

    const res = await startTestRun({ payload: {} });

    expect(res.status).toBe(403);
    expect(authorize).toHaveBeenCalledWith(workspaceId, "readWrite");
    expect(service.createTestRun).not.toHaveBeenCalled();
    expect(runTest).not.toHaveBeenCalled();
  });

  test("answers an unknown workflow like a forbidden one", async () => {
    service.getWorkflowById.mockResolvedValue(null);

    expect((await startTestRun({ payload: {} })).status).toBe(403);
  });

  test("refuses an archived workflow and one without a Webhook trigger", async () => {
    service.getWorkflowById.mockResolvedValueOnce(makeRow({ status: "archived" }));
    expect((await startTestRun({ payload: {} })).status).toBe(422);

    service.getWorkflowById.mockResolvedValueOnce(
      makeRow({
        definition: {
          ...webhookDefinition,
          trigger: {
            id: "trigger",
            type: "trigger",
            triggerType: "response.completed",
            config: { surveyId, endingCardIds: [] },
          },
        },
      })
    );
    expect((await startTestRun({ payload: {} })).status).toBe(422);
    expect(service.createTestRun).not.toHaveBeenCalled();
  });

  test("refuses a draft that cannot run, naming what to fix", async () => {
    service.getWorkflowById.mockResolvedValue(makeRow({ definition: { ...webhookDefinition, edges: [] } }));

    const res = await startTestRun({ payload: {} });

    expect(res.status).toBe(422);
    expect(((await res.json()) as { code: string }).code).toBe("workflow_not_executable");
    expect(service.createTestRun).not.toHaveBeenCalled();
  });

  test("refuses a payload that is not a JSON object within the limits, and unknown body keys", async () => {
    expect((await startTestRun({ payload: [1, 2] })).status).toBe(400);
    expect((await startTestRun({ payload: { a: "x".repeat(101 * 1024) } })).status).toBe(413);
    expect((await startTestRun({ payload: {}, sample: true })).status).toBe(400);
    expect(service.createTestRun).not.toHaveBeenCalled();
  });

  test("is audited with the run id only, never the payload", async () => {
    await startTestRun({ payload: { email: "ana@example.com" } });

    expect(recordAudit).toHaveBeenCalledWith({
      targetId: workflowId,
      workspaceId,
      newObject: { runId, status: "completed" },
    });
  });
});
