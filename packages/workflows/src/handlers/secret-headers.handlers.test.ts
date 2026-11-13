import { beforeEach, describe, expect, test, vi } from "vitest";
import type { WorkflowRowWithLastRun, WorkflowsLogger } from "../services/ports";
import type { WorkflowsService } from "../services/workflows.service";
import type { TWorkflowDefinition } from "../types/document";
import type { AuthorizedWorkspace, WorkflowApiContext, WorkflowSecretStore } from "./context";
import { createWorkflowsHandlers } from "./workflows.handlers";

const surveyId = "cm9zr4q7i000108l84gozfggr";
const workspaceId = "cm9zr4mps000008l8btfy1vtz";
const workflowId = "cm9zr4t2b000208l8h2m1aq3c";
const copyId = "cm9zr4t2b000208l8copy0001";
const storedSecretId = "cm9zr4t2b000208l8secret01";
const foreignSecretId = "cm9zr4t2b000208l8foreign1";
const SECRET_VALUE = "sk_live_do_not_leak_4242";

type THeaderInput = Record<string, unknown>;

const definitionWith = (headers: THeaderInput[]): TWorkflowDefinition =>
  ({
    schemaVersion: 1,
    trigger: {
      id: "trigger",
      type: "trigger",
      triggerType: "response.completed",
      config: { surveyId, endingCardIds: [] },
    },
    nodes: [
      {
        id: "call",
        type: "action",
        actionType: "http_request",
        config: {
          method: "POST",
          url: "https://api.example.com/hook",
          queryParameters: [],
          headers,
          body: "{}",
          responseMode: "wait",
          continueOnError: false,
        },
      },
    ],
    edges: [{ id: "e1", source: "trigger", target: "call" }],
    entryNodeId: "trigger",
  }) as unknown as TWorkflowDefinition;

const makeRow = (overrides: Partial<WorkflowRowWithLastRun> = {}): WorkflowRowWithLastRun => ({
  id: workflowId,
  createdAt: new Date("2026-06-11T09:30:00.000Z"),
  updatedAt: new Date("2026-06-12T09:30:00.000Z"),
  name: "Call CRM",
  description: null,
  status: "draft",
  workspaceId,
  createdBy: null,
  creator: null,
  definition: definitionWith([{ name: "Authorization", secret: true, secretId: storedSecretId }]),
  runs: [],
  _count: { runs: 0 },
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

const store = {
  create: vi.fn<WorkflowSecretStore["create"]>(),
  replace: vi.fn<WorkflowSecretStore["replace"]>(),
  deleteUnreferenced: vi.fn<WorkflowSecretStore["deleteUnreferenced"]>(),
};
const recordAudit = vi.fn<NonNullable<WorkflowApiContext["recordAudit"]>>();
const recordSecretHeaderChanges = vi.fn<NonNullable<WorkflowApiContext["recordSecretHeaderChanges"]>>();
const logger: WorkflowsLogger = { warn: vi.fn(), error: vi.fn() };
const authorized: AuthorizedWorkspace = { workspaceId, organizationId: "cm9zr5org00000000000000000" };

const makeCtx = (overrides: Partial<WorkflowApiContext> = {}): WorkflowApiContext => ({
  userId: "cm9zr52kh000508l8e3q7bw9j",
  requestId: "req_1",
  logger,
  authorize: vi.fn().mockResolvedValue(authorized),
  verifyTriggerSurvey: vi.fn().mockResolvedValue({ surveyExists: true, missingEndingCardIds: [] }),
  verifyRecipientsAllowed: vi.fn().mockResolvedValue({ disallowedEmails: [] }),
  listUnreadableSurveyIds: vi.fn().mockResolvedValue([]),
  secrets: store,
  recordAudit,
  recordSecretHeaderChanges,
  ...overrides,
});

const jsonRequest = (method: string, body: unknown): Request =>
  new Request("http://localhost/api/v3/workflows", {
    method,
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });

/** The definition the handler handed to the service, i.e. what would be persisted. */
const persistedDefinition = (call: { definition?: TWorkflowDefinition } | undefined): TWorkflowDefinition => {
  if (!call?.definition) throw new Error("expected a persisted definition");
  return call.definition;
};

const headersOf = (definition: TWorkflowDefinition): THeaderInput[] => {
  const node = definition.nodes[0];
  if (node.type !== "action" || node.actionType !== "http_request") throw new Error("expected http_request");
  return node.config.headers;
};

/** Echo the definition the service was asked to save back as the stored row. */
const echoUpdate = () =>
  service.updateWorkflow.mockImplementation((_scope, data) =>
    Promise.resolve(makeRow({ definition: persistedDefinition(data) }))
  );

beforeEach(() => {
  vi.clearAllMocks();
  store.create.mockResolvedValue({ id: storedSecretId });
  store.replace.mockResolvedValue(undefined);
  store.deleteUnreferenced.mockResolvedValue(undefined);
});

describe("secret headers on create", () => {
  test("stores the value encrypted, saves only its id, and never returns or audits the value", async () => {
    service.createWorkflow.mockImplementation((input) =>
      Promise.resolve(makeRow({ definition: input.definition, status: "draft" }))
    );
    echoUpdate();

    const res = await handlers.create({
      req: jsonRequest("POST", {
        workspaceId,
        name: "Call CRM",
        definition: definitionWith([{ name: "Authorization", value: SECRET_VALUE, secret: true }]),
      }),
      ctx: makeCtx(),
    });

    expect(res.status).toBe(201);
    expect(store.create).toHaveBeenCalledWith({ workflowId, workspaceId, value: SECRET_VALUE });
    // Created without the value, then pointed at the stored secret.
    expect(JSON.stringify(service.createWorkflow.mock.calls[0][0])).not.toContain(SECRET_VALUE);
    expect(headersOf(persistedDefinition(service.updateWorkflow.mock.calls[0][1]))).toEqual([
      { name: "Authorization", secret: true, secretId: storedSecretId },
    ]);

    const body = await res.text();
    expect(body).not.toContain(SECRET_VALUE);
    expect(body).not.toContain(storedSecretId);
    const returned = (JSON.parse(body) as { data: { definition: TWorkflowDefinition } }).data.definition;
    expect(headersOf(returned)).toEqual([{ name: "Authorization", secret: true, isSet: true }]);
    expect(JSON.stringify(recordAudit.mock.calls)).not.toContain(SECRET_VALUE);
    expect(JSON.stringify(recordAudit.mock.calls)).not.toContain(storedSecretId);
    expect(recordSecretHeaderChanges).toHaveBeenCalledWith({
      workflowId,
      workspaceId,
      changes: [{ stepId: "call", headerName: "Authorization", change: "set" }],
    });
    expect(JSON.stringify(recordSecretHeaderChanges.mock.calls)).not.toContain(SECRET_VALUE);
  });

  test("an API key header is secret unless the write says otherwise", async () => {
    service.createWorkflow.mockImplementation((input) =>
      Promise.resolve(makeRow({ definition: input.definition }))
    );
    echoUpdate();

    await handlers.create({
      req: jsonRequest("POST", {
        workspaceId,
        name: "Call CRM",
        definition: definitionWith([
          { name: "X-Api-Key", value: SECRET_VALUE },
          { name: "X-Session-Token", value: "visible", secret: false },
        ]),
      }),
      ctx: makeCtx(),
    });

    expect(store.create).toHaveBeenCalledWith({ workflowId, workspaceId, value: SECRET_VALUE });
    expect(headersOf(persistedDefinition(service.updateWorkflow.mock.calls[0][1]))).toEqual([
      { name: "X-Api-Key", secret: true, secretId: storedSecretId },
      { name: "X-Session-Token", value: "visible", secret: false },
    ]);
  });
});

describe("secret headers on patch", () => {
  beforeEach(() => {
    service.getWorkflowById.mockResolvedValue(makeRow());
    echoUpdate();
  });

  test("Replace overwrites the stored secret in place, so the id (and every version using it) is kept", async () => {
    const res = await handlers.patch({
      req: jsonRequest("PATCH", {
        definition: definitionWith([{ name: "authorization", secret: true, value: "rotated" }]),
      }),
      ctx: makeCtx(),
      params: { workflowId },
    });

    expect(res.status).toBe(200);
    expect(store.replace).toHaveBeenCalledWith({
      secretId: storedSecretId,
      workflowId,
      workspaceId,
      value: "rotated",
    });
    expect(store.create).not.toHaveBeenCalled();
    expect(headersOf(persistedDefinition(service.updateWorkflow.mock.calls[0][1]))).toEqual([
      { name: "authorization", secret: true, secretId: storedSecretId },
    ]);
    expect(recordSecretHeaderChanges).toHaveBeenCalledWith(
      expect.objectContaining({
        changes: [{ stepId: "call", headerName: "authorization", change: "replaced" }],
      })
    );
  });

  test("sending back what GET returned keeps the stored secret untouched", async () => {
    await handlers.patch({
      req: jsonRequest("PATCH", {
        definition: definitionWith([{ name: "Authorization", secret: true, isSet: true }]),
      }),
      ctx: makeCtx(),
      params: { workflowId },
    });

    expect(store.replace).not.toHaveBeenCalled();
    expect(store.create).not.toHaveBeenCalled();
    expect(recordSecretHeaderChanges).not.toHaveBeenCalled();
    expect(headersOf(persistedDefinition(service.updateWorkflow.mock.calls[0][1]))).toEqual([
      { name: "Authorization", secret: true, secretId: storedSecretId },
    ]);
  });

  test("a secret id sent by the client is ignored, so no workflow can borrow another's secret", async () => {
    await handlers.patch({
      req: jsonRequest("PATCH", {
        definition: definitionWith([{ name: "X-Other", secret: true, secretId: foreignSecretId }]),
      }),
      ctx: makeCtx(),
      params: { workflowId },
    });

    expect(headersOf(persistedDefinition(service.updateWorkflow.mock.calls[0][1]))).toEqual([
      { name: "X-Other", secret: true },
    ]);
  });
});

describe("duplicate and enable", () => {
  test("a duplicate keeps the header names but not the values, and can't be enabled until re-entered", async () => {
    service.getWorkflowById.mockResolvedValueOnce(makeRow());
    service.duplicateWorkflow.mockImplementation((source) =>
      Promise.resolve(makeRow({ id: copyId, definition: source.definition }))
    );

    const res = await handlers.duplicate({
      req: jsonRequest("POST", {}),
      ctx: makeCtx(),
      params: { workflowId },
    });
    expect(res.status).toBe(201);
    const copied = service.duplicateWorkflow.mock.calls[0][0].definition;
    expect(headersOf(copied)).toEqual([{ name: "Authorization", secret: true }]);

    service.getWorkflowById.mockResolvedValueOnce(makeRow({ id: copyId, definition: copied }));
    const enabled = await handlers.enable({ ctx: makeCtx(), params: { workflowId: copyId } });
    expect(enabled.status).toBe(422);
    expect(await enabled.text()).toContain("Authorization");
    expect(service.enableWorkflow).not.toHaveBeenCalled();
  });

  test("enabling deletes the workflow's secrets that nothing references any more", async () => {
    const row = makeRow();
    service.getWorkflowById.mockResolvedValue(row);
    service.enableWorkflow.mockResolvedValue(makeRow({ status: "enabled" }));

    const res = await handlers.enable({ ctx: makeCtx(), params: { workflowId } });

    expect(res.status).toBe(200);
    expect(store.deleteUnreferenced).toHaveBeenCalledWith({
      workflowId,
      workspaceId,
      referencedSecretIds: [storedSecretId],
    });
  });
});
