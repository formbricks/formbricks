import { NextRequest } from "next/server";
import { createHash } from "node:crypto";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { POST } from "./route";

/**
 * The public Webhook Secret URL (ENG-7177): one test per row of the ED2 status table, the order of
 * checks from spec §3, and the proof that the token never reaches a log line, a problem body or a
 * Sentry event.
 */

vi.unmock("crypto");

const TOKEN = "q8Zk3vT1xN2yR5wP7mC4bA";
const OTHER_TOKEN = "Zz9Yy8Xx7Ww6Vv5Uu4Tt3S";
const WORKFLOW_ID = "cm9zr4t2b000208l8h2m1aq3c";
const WORKSPACE_ID = "cm9zr4mps000008l8btfy1vtz";
const ORGANIZATION_ID = "cm9zr5org000008l8abcdefgh";
const VERSION_ID = "cm9zr4ver000308l8abcdefgh";
const RUN_ID = "cm9zr4w9d000308l8c5n8xk7e";
const tokenHash = (token: string) => createHash("sha256").update(token).digest("hex");

const { mocks, flags, logLines, sentryCalls, TooManyRequests } = vi.hoisted(() => {
  class TooManyRequests extends Error {
    retryAfter?: number;
    constructor(retryAfter?: number) {
      super("Maximum number of requests reached. Please try again later.");
      this.name = "TooManyRequestsError";
      this.retryAfter = retryAfter;
    }
  }
  return {
    TooManyRequests,
    mocks: {
      workflowFindUnique: vi.fn(),
      runFindUnique: vi.fn(),
      runCreate: vi.fn(),
      sampleUpsert: vi.fn(),
      applyRateLimit: vi.fn(),
      getIsWorkflowsEnabled: vi.fn(),
      dispatch: vi.fn(),
      markDispatched: vi.fn(),
      meter: vi.fn(),
    },
    flags: { allowPlainHttp: false },
    logLines: [] as unknown[],
    sentryCalls: [] as unknown[],
  };
});

vi.mock("@formbricks/database", () => {
  const tx = {
    workflowSample: { upsert: mocks.sampleUpsert },
    workflowRun: { create: mocks.runCreate },
  };
  return {
    prisma: {
      workflow: { findUnique: mocks.workflowFindUnique },
      workflowRun: { findUnique: mocks.runFindUnique },
      $transaction: vi.fn((fn: (client: typeof tx) => Promise<unknown>) => fn(tx)),
    },
  };
});
vi.mock("@formbricks/types/errors", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  TooManyRequestsError: TooManyRequests,
}));
vi.mock("@/modules/core/rate-limit/helpers", () => ({ applyRateLimit: mocks.applyRateLimit }));
vi.mock("@/modules/ee/license-check/lib/utils", () => ({
  getIsWorkflowsEnabled: mocks.getIsWorkflowsEnabled,
}));
vi.mock("@/modules/ee/workflows/lib/runner/dispatch", () => ({ dispatchWorkflowRunViaJobs: mocks.dispatch }));
vi.mock("@/modules/ee/workflows/lib/runner/mark-dispatched", () => ({
  markWorkflowRunDispatched: mocks.markDispatched,
}));
vi.mock("@/modules/ee/billing/lib/metering", () => ({ recordWorkflowRunCreatedMeterEvent: mocks.meter }));
vi.mock("@/lib/constants", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  get ALLOW_WORKFLOW_PLAIN_HTTP() {
    return flags.allowPlainHttp;
  },
  WORKFLOW_WEBHOOK_DAILY_RUN_LIMIT: 10_000,
  WORKFLOW_WEBHOOK_ORG_CALLS_PER_MINUTE: 300,
  SENTRY_DSN: "https://public@sentry.example.com/1",
  IS_PRODUCTION: true,
}));
vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn((...args: unknown[]) => sentryCalls.push(args)),
}));
vi.mock("@formbricks/logger", () => {
  const record =
    (level: string, context: unknown) =>
    (...args: unknown[]) =>
      logLines.push({ level, context, args });
  interface TRecordingLogger {
    debug: (...args: unknown[]) => number;
    info: (...args: unknown[]) => number;
    warn: (...args: unknown[]) => number;
    error: (...args: unknown[]) => number;
    withContext: (more: unknown) => TRecordingLogger;
  }
  const child = (context: unknown): TRecordingLogger => ({
    debug: record("debug", context),
    info: record("info", context),
    warn: record("warn", context),
    error: record("error", context),
    withContext: (more: unknown) => child({ context, more }),
  });
  return { logger: { ...child(null), withContext: (context: unknown) => child(context) } };
});

const webhookWorkflow = (overrides: Record<string, unknown> = {}) => ({
  id: WORKFLOW_ID,
  status: "enabled",
  workspaceId: WORKSPACE_ID,
  webhookTokenHash: tokenHash(TOKEN),
  definition: { trigger: { id: "trigger", type: "trigger", triggerType: "webhook", config: {} } },
  versions: [{ id: VERSION_ID }],
  workspace: { organizationId: ORGANIZATION_ID, organization: { billing: { stripeCustomerId: "cus_1" } } },
  ...overrides,
});

const call = ({
  token = TOKEN,
  workflowId = WORKFLOW_ID,
  body = '{"order":{"id":42}}',
  headers = {},
}: {
  token?: string;
  workflowId?: string;
  body?: string | ReadableStream<Uint8Array>;
  headers?: Record<string, string>;
} = {}) =>
  POST(
    new NextRequest(`https://app.example.com/api/v3/workflows/${workflowId}/webhook/${token}`, {
      method: "POST",
      body,
      headers: {
        "content-type": "application/json",
        "x-forwarded-proto": "https",
        "x-formbricks-client-ip": "203.0.113.9",
        ...headers,
      },
      duplex: "half",
    }),
    { params: Promise.resolve({ workflowId, token }) }
  );

const problem = async (response: Response) => {
  const { requestId: _requestId, ...rest } = (await response.json()) as Record<string, unknown>;
  return rest;
};

beforeEach(() => {
  vi.clearAllMocks();
  logLines.length = 0;
  sentryCalls.length = 0;
  flags.allowPlainHttp = false;
  mocks.applyRateLimit.mockResolvedValue({ allowed: true });
  mocks.workflowFindUnique.mockResolvedValue(webhookWorkflow());
  mocks.runFindUnique.mockResolvedValue(null);
  mocks.runCreate.mockResolvedValue({ id: RUN_ID, createdAt: new Date("2026-11-13T10:00:00.000Z") });
  mocks.sampleUpsert.mockResolvedValue({});
  mocks.getIsWorkflowsEnabled.mockResolvedValue(true);
  mocks.dispatch.mockResolvedValue(undefined);
  mocks.markDispatched.mockResolvedValue(undefined);
  mocks.meter.mockResolvedValue(undefined);
});

describe("an enabled workflow", () => {
  test("answers 202 with the queued run, which carries the payload and the caller's IP", async () => {
    const response = await call();

    expect(response.status).toBe(202);
    expect(await response.json()).toEqual({ runId: RUN_ID });
    expect(mocks.runCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        workflowId: WORKFLOW_ID,
        workspaceId: WORKSPACE_ID,
        workflowVersionId: VERSION_ID,
        status: "queued",
        triggerType: "webhook",
        isDryRun: false,
        idempotencyKey: null,
        callerIp: "203.0.113.9",
        triggerPayload: {
          type: "webhook",
          workspaceId: WORKSPACE_ID,
          payload: { order: { id: 42 } },
          triggeredAt: expect.any(String),
        },
      }),
      select: { id: true, createdAt: true },
    });
    expect(mocks.dispatch).toHaveBeenCalledWith({
      workflowRunId: RUN_ID,
      workflowId: WORKFLOW_ID,
      workspaceId: WORKSPACE_ID,
    });
  });

  test("saves the payload as the sample with the call's time and IP", async () => {
    await call();

    expect(mocks.sampleUpsert).toHaveBeenCalledWith({
      where: { workflowId_source: { workflowId: WORKFLOW_ID, source: "trigger" } },
      create: expect.objectContaining({
        workflowId: WORKFLOW_ID,
        workspaceId: WORKSPACE_ID,
        source: "trigger",
        sample: { order: { id: 42 } },
        lastCallerIp: "203.0.113.9",
      }),
      update: expect.objectContaining({ sample: { order: { id: 42 } }, lastCallerIp: "203.0.113.9" }),
    });
  });

  test("bills the run once, like any other run", async () => {
    await call();

    expect(mocks.meter).toHaveBeenCalledWith(
      expect.objectContaining({ stripeCustomerId: "cus_1", workflowRunId: RUN_ID })
    );
  });

  test("still answers 202 when the queue hand-off fails; the reconciler re-dispatches the run", async () => {
    mocks.dispatch.mockRejectedValue(new Error("redis down"));

    const response = await call();

    expect(response.status).toBe(202);
    expect(mocks.markDispatched).not.toHaveBeenCalled();
  });
});

describe.each(["draft", "disabled"])("a %s workflow", (status) => {
  test("answers 202 with no run and saves the sample", async () => {
    mocks.workflowFindUnique.mockResolvedValue(webhookWorkflow({ status }));

    const response = await call();

    expect(response.status).toBe(202);
    expect(await response.json()).toEqual({ runId: null });
    expect(mocks.sampleUpsert).toHaveBeenCalled();
    expect(mocks.runCreate).not.toHaveBeenCalled();
    expect(mocks.dispatch).not.toHaveBeenCalled();
    expect(mocks.meter).not.toHaveBeenCalled();
  });
});

describe("Idempotency-Key", () => {
  test("a key seen before answers 200 with the earlier run and starts nothing", async () => {
    mocks.runFindUnique.mockResolvedValue({ id: RUN_ID });

    const response = await call({ headers: { "idempotency-key": "order-42" } });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ runId: RUN_ID });
    expect(mocks.runFindUnique).toHaveBeenCalledWith({
      where: { workflowId_idempotencyKey: { workflowId: WORKFLOW_ID, idempotencyKey: "webhook:order-42" } },
      select: { id: true },
    });
    expect(mocks.runCreate).not.toHaveBeenCalled();
    expect(mocks.dispatch).not.toHaveBeenCalled();
  });

  test("a new key is stored on the run, in its own key space", async () => {
    await call({ headers: { "idempotency-key": "order-43" } });

    expect(mocks.runCreate.mock.calls[0][0].data.idempotencyKey).toBe("webhook:order-43");
  });

  test("a concurrent call with the same key that wins the race is returned with 200", async () => {
    mocks.runCreate.mockRejectedValue(Object.assign(new Error("Unique constraint"), { code: "P2002" }));
    mocks.runFindUnique.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: RUN_ID });

    const response = await call({ headers: { "idempotency-key": "order-44" } });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ runId: RUN_ID });
    expect(mocks.dispatch).not.toHaveBeenCalled();
  });

  test("a key over 255 characters answers 400", async () => {
    const response = await call({ headers: { "idempotency-key": "k".repeat(256) } });

    expect(response.status).toBe(400);
    expect(mocks.runCreate).not.toHaveBeenCalled();
  });
});

describe("archived, unknown or regenerated token", () => {
  const cases: Array<[string, () => void, Parameters<typeof call>[0]?]> = [
    [
      "an archived workflow",
      () => mocks.workflowFindUnique.mockResolvedValue(webhookWorkflow({ status: "archived" })),
    ],
    ["an unknown workflow", () => mocks.workflowFindUnique.mockResolvedValue(null)],
    ["a wrong token", () => undefined, { token: OTHER_TOKEN }],
    [
      "a regenerated token",
      () =>
        mocks.workflowFindUnique.mockResolvedValue(
          webhookWorkflow({ webhookTokenHash: tokenHash(OTHER_TOKEN) })
        ),
    ],
    [
      "a workflow whose trigger is no longer a Webhook trigger",
      () =>
        mocks.workflowFindUnique.mockResolvedValue(
          webhookWorkflow({ definition: { trigger: { triggerType: "response.completed" } } })
        ),
    ],
    [
      "a workflow without a token",
      () => mocks.workflowFindUnique.mockResolvedValue(webhookWorkflow({ webhookTokenHash: null })),
    ],
    ["an id that is not a workflow id", () => undefined, { workflowId: "not-a-cuid" }],
  ];

  test.each(cases)("%s answers the same 404", async (_label, arrange, options) => {
    const reference = await problem(await call({ token: OTHER_TOKEN }));
    vi.clearAllMocks();
    mocks.applyRateLimit.mockResolvedValue({ allowed: true });
    mocks.workflowFindUnique.mockResolvedValue(webhookWorkflow());
    arrange();

    const response = await call(options);

    expect(response.status).toBe(404);
    const body = await problem(response);
    // Identical in every case, apart from the request path, which carries the caller's own id.
    expect({ ...body, instance: undefined }).toEqual({ ...reference, instance: undefined });
    expect(mocks.sampleUpsert).not.toHaveBeenCalled();
    expect(mocks.runCreate).not.toHaveBeenCalled();
  });

  test("a regenerated token stops working at once, even on a body that would otherwise fail", async () => {
    mocks.workflowFindUnique.mockResolvedValue(webhookWorkflow({ webhookTokenHash: tokenHash(OTHER_TOKEN) }));

    const response = await call({ body: "[not json", headers: { "x-forwarded-proto": "http" } });

    expect(response.status).toBe(404);
  });
});

describe("body", () => {
  test.each([
    ["malformed JSON", "{not json"],
    ["a list", "[1,2,3]"],
    ["a string", '"hello"'],
    ["nesting deeper than ten levels", `${'{"a":'.repeat(11)}1${"}".repeat(11)}`],
  ])("answers 400 for %s, without echoing it", async (_label, body) => {
    const response = await call({ body: body.replace("1", '"echo-me-not"') });

    expect(response.status).toBe(400);
    expect(await response.text()).not.toContain("echo-me-not");
    expect(mocks.sampleUpsert).not.toHaveBeenCalled();
  });

  test("answers 413 for a body over 100 KB", async () => {
    const response = await call({ body: JSON.stringify({ text: "x".repeat(100 * 1024) }) });

    expect(response.status).toBe(413);
    expect(mocks.sampleUpsert).not.toHaveBeenCalled();
  });

  test("answers 413 for an over-size body sent without a Content-Length", async () => {
    const chunk = new TextEncoder().encode("x".repeat(64 * 1024));
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('{"text":"'));
        controller.enqueue(chunk);
        controller.enqueue(chunk);
        controller.enqueue(new TextEncoder().encode('"}'));
        controller.close();
      },
    });

    const response = await call({ body: stream });

    expect(response.status).toBe(413);
  });

  test("answers 415 for a body that is not application/json", async () => {
    const response = await call({ headers: { "content-type": "text/plain" } });

    expect(response.status).toBe(415);
    expect(mocks.sampleUpsert).not.toHaveBeenCalled();
  });

  test("accepts application/json with a charset", async () => {
    const response = await call({ headers: { "content-type": "application/json; charset=utf-8" } });

    expect(response.status).toBe(202);
  });
});

describe("limits", () => {
  const limitBy = (namespace: string) =>
    mocks.applyRateLimit.mockImplementation(async (config: { namespace: string }) => {
      if (config.namespace === namespace) throw new TooManyRequests(42);
      return { allowed: true };
    });

  test("100 calls a minute per workflow answer 429 with Retry-After, before the database is read", async () => {
    limitBy("api:v3:workflow-webhook");

    const response = await call();

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("42");
    expect(mocks.applyRateLimit).toHaveBeenCalledWith(
      expect.objectContaining({
        namespace: "api:v3:workflow-webhook",
        allowedPerInterval: 100,
        interval: 60,
      }),
      WORKFLOW_ID
    );
    expect(mocks.workflowFindUnique).not.toHaveBeenCalled();
  });

  test("the organization's calls per minute answer 429", async () => {
    limitBy("api:v3:workflow-webhook:organization");

    const response = await call();

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("42");
    expect(mocks.applyRateLimit).toHaveBeenCalledWith(
      expect.objectContaining({ allowedPerInterval: 300, interval: 60 }),
      ORGANIZATION_ID
    );
    expect(mocks.runCreate).not.toHaveBeenCalled();
  });

  test("the workflow's runs per day answer 429", async () => {
    limitBy("api:v3:workflow-webhook:daily-runs");

    const response = await call();

    expect(response.status).toBe(429);
    expect(mocks.applyRateLimit).toHaveBeenCalledWith(
      expect.objectContaining({ allowedPerInterval: 10_000, interval: 86_400, failClosed: true }),
      WORKFLOW_ID
    );
    expect(mocks.runCreate).not.toHaveBeenCalled();
  });

  test("a draft does not spend the daily run cap, since it starts no run", async () => {
    limitBy("api:v3:workflow-webhook:daily-runs");
    mocks.workflowFindUnique.mockResolvedValue(webhookWorkflow({ status: "draft" }));

    expect((await call()).status).toBe(202);
  });
});

describe("403", () => {
  test("when the organization's plan no longer includes workflows", async () => {
    mocks.getIsWorkflowsEnabled.mockResolvedValue(false);

    const response = await call();

    expect(response.status).toBe(403);
    expect(mocks.getIsWorkflowsEnabled).toHaveBeenCalledWith(ORGANIZATION_ID);
    expect(mocks.sampleUpsert).not.toHaveBeenCalled();
  });

  test("for plain HTTP", async () => {
    const response = await call({ headers: { "x-forwarded-proto": "http" } });

    expect(response.status).toBe(403);
    expect(mocks.sampleUpsert).not.toHaveBeenCalled();
  });

  test("not for plain HTTP when the self-hosting switch is on", async () => {
    flags.allowPlainHttp = true;

    expect((await call({ headers: { "x-forwarded-proto": "http" } })).status).toBe(202);
  });

  test("not for plain HTTP to localhost", async () => {
    const response = await POST(
      new NextRequest(`http://localhost:3000/api/v3/workflows/${WORKFLOW_ID}/webhook/${TOKEN}`, {
        method: "POST",
        body: "{}",
        headers: { "content-type": "application/json" },
      }),
      { params: Promise.resolve({ workflowId: WORKFLOW_ID, token: TOKEN }) }
    );

    expect(response.status).toBe(202);
  });

  test("reads the first X-Forwarded-Proto hop", async () => {
    expect((await call({ headers: { "x-forwarded-proto": "https, http" } })).status).toBe(202);
  });
});

describe("the token never leaves in a log line, a problem body or a Sentry event", () => {
  const everythingRecorded = async (response: Response) =>
    JSON.stringify({ body: await response.text(), logLines, sentryCalls });

  const leakCases: Array<[string, () => void, string?]> = [
    ["a 404", () => void mocks.workflowFindUnique.mockResolvedValue(null)],
    ["a 400", () => undefined, "{broken"],
    ["a 429", () => void mocks.applyRateLimit.mockRejectedValue(new TooManyRequests(1))],
    [
      "a 500 from the database",
      () => void mocks.workflowFindUnique.mockRejectedValue(new Error(`boom at /webhook/${TOKEN}`)),
    ],
    ["a 500 while saving", () => void mocks.sampleUpsert.mockRejectedValue(new Error("db down"))],
  ];

  test.each(leakCases)("on %s", async (_label, arrange, body) => {
    arrange();

    const response = await call({ body });
    const recorded = await everythingRecorded(response);

    expect(recorded).not.toContain(TOKEN);
  });

  test("a 500 is still reported to Sentry and logged, with the path redacted", async () => {
    mocks.sampleUpsert.mockRejectedValue(new Error("db down"));

    const response = await call();

    expect(response.status).toBe(500);
    expect(sentryCalls.length).toBeGreaterThan(0);
    expect(JSON.stringify(logLines)).toContain(`/api/v3/workflows/${WORKFLOW_ID}/webhook/[redacted]`);
  });
});
