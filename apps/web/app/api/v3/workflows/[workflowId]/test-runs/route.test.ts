import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { TooManyRequestsError } from "@formbricks/types/errors";
import { POST } from "./route";

/**
 * The whole Test run path behind the route, with the real runner: authentication, the per-principal
 * budget, write access, the package operation, the walker, the step executors and the fake effects.
 * The database is an in-memory fake of the workflow, run and run-log tables; the real email and HTTP
 * transports, the job queue and billing are mocked only to prove nothing reaches them.
 */
const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  authenticateRequest: vi.fn(),
  applyRateLimit: vi.fn(),
  requireV3WorkspaceAccess: vi.fn(),
  getIsWorkflowsEnabled: vi.fn(),
  queueAuditEvent: vi.fn(),
  sendEmail: vi.fn(),
  sendHttp: vi.fn(),
  enqueueDelivery: vi.fn(),
  enqueueRun: vi.fn(),
  meter: vi.fn(),
  db: {
    workflow: null as Record<string, unknown> | null,
    samples: [] as { source: string; sample: Record<string, unknown> }[],
    runs: new Map<string, Record<string, unknown>>(),
    logs: [] as Record<string, unknown>[],
  },
}));

vi.mock("@/modules/auth/lib/session", () => ({ getSession: mocks.getSession }));
vi.mock("@/app/api/v1/auth", () => ({ authenticateRequest: mocks.authenticateRequest }));
vi.mock("@/modules/core/rate-limit/helpers", () => ({ applyRateLimit: mocks.applyRateLimit }));
vi.mock("@/app/api/v3/lib/auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/app/api/v3/lib/auth")>()),
  requireV3WorkspaceAccess: mocks.requireV3WorkspaceAccess,
}));
vi.mock("@/modules/ee/license-check/lib/utils", () => ({
  getIsWorkflowsEnabled: mocks.getIsWorkflowsEnabled,
}));
vi.mock("@/modules/ee/audit-logs/lib/handler", () => ({ queueAuditEvent: mocks.queueAuditEvent }));
vi.mock("@/lib/utils/helper", () => ({ getOrganizationIdFromWorkspaceId: async () => "org_1" }));
vi.mock("@/lib/posthog", () => ({ capturePostHogEvent: vi.fn() }));
vi.mock("@formbricks/logger", () => {
  const log = { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() };
  return { logger: { ...log, withContext: vi.fn(() => log) } };
});

// What a run could reach outside the app: none of it may be called.
vi.mock("@/modules/email", () => ({ sendEmail: mocks.sendEmail }));
vi.mock("@/modules/ee/workflows/lib/http-request/send-http-request", () => ({
  sendWorkflowHttpRequest: mocks.sendHttp,
  WORKFLOW_HTTP_RETRIES: 3,
}));
vi.mock("@formbricks/jobs", () => ({
  enqueueWorkflowHttpRequestDeliveryJob: mocks.enqueueDelivery,
  enqueueWorkflowRunJob: mocks.enqueueRun,
}));
vi.mock("@/modules/ee/billing/lib/metering", () => ({ recordWorkflowRunCreatedMeterEvent: mocks.meter }));

// The run environment's reads, none of which matter to a Webhook workflow with a payload recipient.
vi.mock("@/modules/email/lib/survey-response-email", () => ({
  buildWorkflowEmailHtml: async () => "<p>Welcome</p>",
  buildSurveyResponseEmailHtml: vi.fn(),
  resolveResponseRecipient: vi.fn(),
}));
vi.mock("@/lib/organization/service", () => ({
  getOrganizationByWorkspaceId: async () => ({ id: "org_1", whitelabel: null }),
}));
vi.mock("@/lib/workspace/service", () => ({ getWorkspaceMemberEmails: async () => new Set() }));
vi.mock("@/modules/email/lib/email-actor", () => ({ resolveEmailActorUserId: async () => null }));
vi.mock("@/lib/response/service", () => ({ getResponse: vi.fn() }));
vi.mock("@/lib/survey/service", () => ({ getSurvey: vi.fn() }));
vi.mock("@/modules/ee/workflows/lib/survey-link-surveys", () => ({
  getWorkflowSurveyLinkSurveys: async () => [],
}));
vi.mock("@/modules/ee/workflows/lib/secret-headers/workflow-secret-store", () => ({
  loadWorkflowSecretValues: async () => new Map(),
  workflowSecretStore: {},
}));

const WORKFLOW_ID = "cm9zr4t2b000208l8h2m1aq3c";
const WORKSPACE_ID = "cm9zr4mps000008l8btfy1vtz";
const VERSION_ID = "cm9zr4ver000008l8btfy1vtz";
const USER_ID = "cm9zr52kh000508l8e3q7bw9j";

const emailNode = (id: string, subject: string) => ({
  id,
  type: "action",
  actionType: "send_email",
  config: {
    to: { type: "variable", ref: "payload.email" },
    from: "noreply@example.com",
    replyTo: [],
    subject,
    body: "<p>Welcome</p>",
    attachResponseData: false,
  },
});

const httpNode = (id: string, responseMode: "wait" | "dont_wait") => ({
  id,
  type: "action",
  actionType: "http_request",
  config: {
    method: "POST",
    url: `https://api.example.com/${id}`,
    queryParameters: [],
    headers: [],
    body: '{"plan":"#recall:payload.plan/fallback:#"}',
    responseMode,
    continueOnError: false,
  },
});

/** The draft: Webhook → If/else (plan is pro) → then: email + HTTP | else: Don't wait HTTP. */
const draftDefinition = {
  schemaVersion: 1,
  entryNodeId: "trigger",
  trigger: { id: "trigger", type: "trigger", triggerType: "webhook", config: {} },
  nodes: [
    {
      id: "check",
      type: "if_else",
      config: {
        condition: {
          id: "group",
          connector: "and",
          conditions: [{ id: "is-pro", left: { path: "payload.plan" }, operator: "equals", right: "pro" }],
        },
      },
    },
    emailNode("welcome", "Welcome to Pro"),
    httpNode("crm", "wait"),
    httpNode("notify", "dont_wait"),
  ],
  edges: [
    { id: "e1", source: "trigger", target: "check" },
    { id: "e2", source: "check", target: "welcome", sourceHandle: "then" },
    { id: "e3", source: "welcome", target: "crm" },
    { id: "e4", source: "check", target: "notify", sourceHandle: "else" },
  ],
};

/** The enabled version: Webhook → one email. A Test run must never walk this one. */
const versionDefinition = {
  ...draftDefinition,
  nodes: [emailNode("version-email", "From the enabled version")],
  edges: [{ id: "v1", source: "trigger", target: "version-email" }],
};

const matchesStatus = (status: unknown, where: unknown): boolean => {
  if (where === undefined) return true;
  if (typeof where === "string") return status === where;
  const filter = where as { in?: unknown[]; notIn?: unknown[] };
  if (filter.in) return filter.in.includes(status);
  if (filter.notIn) return !filter.notIn.includes(status);
  return true;
};

const findLog = (runId: string, stepId: string) =>
  mocks.db.logs.find((log) => log.runId === runId && log.stepId === stepId) ?? null;

vi.mock("@formbricks/database", () => ({
  prisma: {
    workflow: { findUnique: vi.fn(async () => mocks.db.workflow) },
    workflowSample: {
      findUnique: vi.fn(async () => {
        const trigger = mocks.db.samples.find((row) => row.source === "trigger");
        return trigger
          ? { workflowId: WORKFLOW_ID, workspaceId: WORKSPACE_ID, ...trigger, updatedAt: new Date() }
          : null;
      }),
      findMany: vi.fn(async () => mocks.db.samples.filter((row) => row.source !== "trigger")),
    },
    workflowRun: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const id = `cm9zr5run00000000000000${mocks.db.runs.size}a`;
        const now = new Date();
        mocks.db.runs.set(id, {
          ...data,
          id,
          createdAt: now,
          updatedAt: now,
          responseId: null,
          surveyId: null,
          error: null,
          data: {},
          idempotencyKey: null,
          nextAttemptAt: null,
          lastErrorAt: null,
          callerIp: null,
          contentDeletedAt: null,
          contentRetentionDays: null,
          startedAt: null,
          finishedAt: null,
        });
        return { id };
      }),
      findFirst: vi.fn(async ({ where }: { where: { id: string; workspaceId: string } }) => {
        const run = mocks.db.runs.get(where.id);
        if (!run || run.workspaceId !== where.workspaceId) return null;
        return {
          ...run,
          // The relation the runner resolves its definition through: the version only when the run has one.
          workflowVersion: run.workflowVersionId === VERSION_ID ? { definition: versionDefinition } : null,
          workflow: {
            definition: (mocks.db.workflow as { definition: unknown }).definition,
            createdBy: USER_ID,
          },
        };
      }),
      updateMany: vi.fn(
        async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
          const run = mocks.db.runs.get(where.id as string);
          if (!run || !matchesStatus(run.status, where.status)) return { count: 0 };
          Object.assign(run, data);
          return { count: 1 };
        }
      ),
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
        const run = mocks.db.runs.get(where.id);
        if (!run) return null;
        return {
          ...run,
          workflowVersion: run.workflowVersionId ? { version: 3 } : null,
          logs: mocks.db.logs
            .filter((log) => log.runId === where.id)
            .sort((a, b) => (a.sequence as number) - (b.sequence as number)),
        };
      }),
    },
    workflowRunLog: {
      findFirst: vi.fn(async ({ where }: { where: { runId: string; stepId: string } }) =>
        findLog(where.runId, where.stepId)
      ),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        mocks.db.logs.push({
          id: `cm9zr5log0000000000000000${mocks.db.logs.length}`,
          output: {},
          error: null,
          finishedAt: null,
          ...data,
        });
      }),
      update: vi.fn(
        async ({
          where,
          data,
        }: {
          where: { runId_stepId: { runId: string; stepId: string } };
          data: Record<string, unknown>;
        }) => {
          Object.assign(findLog(where.runId_stepId.runId, where.runId_stepId.stepId) ?? {}, data);
        }
      ),
      updateMany: vi.fn(async () => ({ count: 0 })),
    },
  },
}));

const post = (body: unknown = {}) =>
  POST(
    new NextRequest(`http://localhost/api/v3/workflows/${WORKFLOW_ID}/test-runs`, {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    }),
    { params: Promise.resolve({ workflowId: WORKFLOW_ID }) } as never
  );

const steps = async (response: Response) =>
  ((await response.json()) as { data: { steps: { stepId: string; status: string; detail: unknown }[] } }).data
    .steps;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.db.runs.clear();
  mocks.db.logs.length = 0;
  mocks.db.samples = [
    { source: "trigger", sample: { plan: "free", email: "sample@example.com" } },
    { source: "crm", sample: { status: 201, contentType: "application/json", body: { id: "c_1" } } },
  ];
  mocks.db.workflow = {
    id: WORKFLOW_ID,
    workspaceId: WORKSPACE_ID,
    name: "Onboarding",
    description: null,
    status: "enabled",
    createdAt: new Date("2026-11-01T09:30:00.000Z"),
    updatedAt: new Date("2026-11-02T09:30:00.000Z"),
    createdBy: USER_ID,
    creator: null,
    definition: draftDefinition,
    runs: [],
    _count: { runs: 0 },
  };
  mocks.getSession.mockResolvedValue({ user: { id: USER_ID }, expires: "2099-01-01" });
  mocks.applyRateLimit.mockResolvedValue(undefined);
  mocks.requireV3WorkspaceAccess.mockResolvedValue({ workspaceId: WORKSPACE_ID, organizationId: "org_1" });
  mocks.getIsWorkflowsEnabled.mockResolvedValue(true);
});

describe("POST /api/v3/workflows/{workflowId}/test-runs", () => {
  test("runs the draft, not the enabled version, and answers with the branch taken", async () => {
    const response = await post({ payload: { plan: "pro", email: "ana@example.com" } });

    expect(response.status).toBe(201);
    const body = (await response.clone().json()) as { data: Record<string, unknown> };
    expect(body.data).toMatchObject({
      isDryRun: true,
      workflowVersionId: null,
      workflowVersionNumber: null,
      status: "completed",
      triggerType: "webhook",
    });
    expect(await steps(response)).toEqual([
      expect.objectContaining({
        stepId: "check",
        status: "succeeded",
        detail: { kind: "if_else", branch: "then", conditions: [{ id: "is-pro", matched: true }] },
      }),
      expect.objectContaining({
        stepId: "welcome",
        status: "succeeded",
        detail: {
          kind: "send_email",
          recipient: "ana@example.com",
          subject: "Welcome to Pro",
          surveyLink: null,
        },
      }),
      expect.objectContaining({
        stepId: "crm",
        status: "succeeded",
        detail: expect.objectContaining({
          request: expect.objectContaining({
            method: "POST",
            url: "https://api.example.com/crm",
            body: '{"plan":"pro"}',
          }),
          response: { status: 201, contentType: "application/json", body: { id: "c_1" } },
          testSample: "used",
        }),
      }),
      expect.objectContaining({ stepId: "notify", status: "not_taken", detail: null }),
    ]);
    expect(mocks.db.logs.map((log) => log.stepId)).not.toContain("version-email");
  });

  test("sends nothing, calls nothing, queues nothing and bills nothing", async () => {
    await post({ payload: { plan: "pro", email: "ana@example.com" } });
    await post({ payload: { plan: "free", email: "ana@example.com" } });

    expect(mocks.sendEmail).not.toHaveBeenCalled();
    expect(mocks.sendHttp).not.toHaveBeenCalled();
    expect(mocks.enqueueDelivery).not.toHaveBeenCalled();
    expect(mocks.enqueueRun).not.toHaveBeenCalled();
    expect(mocks.meter).not.toHaveBeenCalled();
  });

  test("the Else branch's Don't wait request ends with what it would send, and the payload defaults to the sample", async () => {
    const response = await post({});

    expect(response.status).toBe(201);
    expect(await steps(response)).toEqual([
      expect.objectContaining({ stepId: "check", detail: expect.objectContaining({ branch: "else" }) }),
      expect.objectContaining({
        stepId: "notify",
        status: "succeeded",
        detail: expect.objectContaining({ mode: "dont_wait", delivery: null, response: null }),
      }),
      expect.objectContaining({ stepId: "welcome", status: "not_taken" }),
      expect.objectContaining({ stepId: "crm", status: "not_taken" }),
    ]);
  });

  test("is audited as testRunStarted with the run id, never the payload", async () => {
    await post({ payload: { plan: "pro", email: "ana@example.com" } });

    expect(mocks.queueAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "testRunStarted",
        targetType: "workflow",
        targetId: WORKFLOW_ID,
        status: "success",
      })
    );
    expect(JSON.stringify(mocks.queueAuditEvent.mock.calls)).not.toContain("ana@example.com");
  });

  test("refuses read-only access without saving or running anything", async () => {
    mocks.requireV3WorkspaceAccess.mockImplementation(async (_auth, _workspaceId, access: string) =>
      access === "read"
        ? { workspaceId: WORKSPACE_ID, organizationId: "org_1" }
        : Response.json(
            { code: "forbidden" },
            { status: 403, headers: { "Content-Type": "application/problem+json" } }
          )
    );

    const response = await post({ payload: { plan: "pro", email: "ana@example.com" } });

    expect(response.status).toBe(403);
    expect(mocks.requireV3WorkspaceAccess.mock.calls[0][2]).toBe("readWrite");
    expect(mocks.db.runs.size).toBe(0);
  });

  test("refuses an unauthenticated caller", async () => {
    mocks.getSession.mockResolvedValue(null);
    mocks.authenticateRequest.mockResolvedValue(null);

    expect((await post()).status).toBe(401);
    expect(mocks.db.runs.size).toBe(0);
  });

  test("answers 429 once the caller's 30 a minute are spent, before reading anything", async () => {
    mocks.applyRateLimit.mockImplementation((config: { namespace: string }) =>
      config.namespace === "api:v3:workflow-test-run"
        ? Promise.reject(new TooManyRequestsError("Maximum number of requests reached", 42))
        : Promise.resolve()
    );

    const response = await post();

    expect(response.status).toBe(429);
    expect(mocks.applyRateLimit).toHaveBeenCalledWith(
      expect.objectContaining({ namespace: "api:v3:workflow-test-run", allowedPerInterval: 30 }),
      USER_ID
    );
    expect(mocks.db.runs.size).toBe(0);
  });

  test("a failing step fails the run, not the call", async () => {
    const response = await post({ payload: { plan: "pro", email: "not-an-address" } });

    expect(response.status).toBe(201);
    const body = (await response.json()) as {
      data: { status: string; steps: { stepId: string; status: string }[] };
    };
    expect(body.data.status).toBe("failed");
    expect(body.data.steps.find((step) => step.stepId === "welcome")?.status).toBe("failed");
  });
});
