import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { TooManyRequestsError } from "@formbricks/types/errors";
import { POST } from "./route";

/**
 * The whole Send test request path behind the route: authentication, the per-user budget, write
 * access, the step lookup, secret resolution, the outbound call (faked at the transport), the saved
 * sample and the audit detail.
 */
const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  authenticateRequest: vi.fn(),
  applyRateLimit: vi.fn(),
  requireV3WorkspaceAccess: vi.fn(),
  getIsWorkflowsEnabled: vi.fn(),
  workflowFindUnique: vi.fn(),
  sampleFindMany: vi.fn(),
  sampleUpsert: vi.fn(),
  loadSecrets: vi.fn(),
  send: vi.fn(),
  queueAuditEvent: vi.fn(),
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
vi.mock("@formbricks/database", () => ({
  prisma: {
    workflow: { findUnique: mocks.workflowFindUnique },
    workflowSample: { findMany: mocks.sampleFindMany, upsert: mocks.sampleUpsert },
  },
}));
vi.mock("@/modules/ee/workflows/lib/secret-headers/workflow-secret-store", () => ({
  loadWorkflowSecretValues: mocks.loadSecrets,
  workflowSecretStore: {},
}));
vi.mock("@/modules/ee/workflows/lib/http-request/send-http-request", () => ({
  sendWorkflowHttpRequest: mocks.send,
}));
vi.mock("@/modules/ee/audit-logs/lib/handler", () => ({ queueAuditEvent: mocks.queueAuditEvent }));
vi.mock("@/lib/utils/helper", () => ({
  getOrganizationIdFromWorkspaceId: vi.fn().mockResolvedValue("org_1"),
}));
vi.mock("@/lib/posthog", () => ({ capturePostHogEvent: vi.fn() }));
vi.mock("@formbricks/logger", () => {
  const log = { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() };
  return { logger: { ...log, withContext: vi.fn(() => log) } };
});

const WORKFLOW_ID = "cm9zr4t2b000208l8h2m1aq3c";
const WORKSPACE_ID = "cm9zr4mps000008l8btfy1vtz";
const SECRET = "Bearer sk_live_route";

const definition = {
  schemaVersion: 1,
  trigger: { id: "trigger", type: "trigger", triggerType: "webhook", config: {} },
  nodes: [
    {
      id: "call",
      type: "action",
      actionType: "http_request",
      config: {
        method: "POST",
        url: "https://api.example.com/customers",
        queryParameters: [{ name: "email", value: "#recall:payload.email/fallback:#" }],
        headers: [{ name: "Authorization", secret: true, secretId: "sec_1" }],
        body: '{"plan":"pro"}',
        responseMode: "wait",
        continueOnError: false,
      },
    },
    { id: "check", type: "if_else", config: { condition: { id: "g", connector: "and", conditions: [] } } },
  ],
  edges: [{ id: "e1", source: "trigger", target: "call" }],
  entryNodeId: "trigger",
};

const request = (stepId: string, body: unknown = {}, headers: Record<string, string> = {}) =>
  new NextRequest(`http://localhost/api/v3/workflows/${WORKFLOW_ID}/steps/${stepId}/test-request`, {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json", ...headers },
  });
const props = (stepId: string) => ({ params: Promise.resolve({ workflowId: WORKFLOW_ID, stepId }) }) as never;
const post = (stepId = "call", body: unknown = {}) => POST(request(stepId, body), props(stepId));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getSession.mockResolvedValue({ user: { id: "cm9zr52kh000508l8e3q7bw9j" }, expires: "2099-01-01" });
  mocks.applyRateLimit.mockResolvedValue(undefined);
  mocks.requireV3WorkspaceAccess.mockResolvedValue({ workspaceId: WORKSPACE_ID, organizationId: "org_1" });
  mocks.getIsWorkflowsEnabled.mockResolvedValue(true);
  mocks.workflowFindUnique.mockResolvedValue({
    id: WORKFLOW_ID,
    workspaceId: WORKSPACE_ID,
    status: "draft",
    definition,
  });
  mocks.sampleFindMany.mockResolvedValue([{ source: "trigger", sample: { email: "ana@example.com" } }]);
  mocks.sampleUpsert.mockResolvedValue({});
  mocks.loadSecrets.mockResolvedValue(new Map([["sec_1", SECRET]]));
  mocks.send.mockResolvedValue({
    response: { status: 201, contentType: "application/json", bodyText: '{"id":"c_1"}', truncated: false },
    error: null,
    attempts: 1,
  });
});

describe("POST /api/v3/workflows/{workflowId}/steps/{stepId}/test-request", () => {
  test("sends the step once with the sample's Variables and its secret, returning it masked", async () => {
    const response = await post();

    expect(response.status).toBe(200);
    expect(mocks.send).toHaveBeenCalledWith(
      {
        method: "POST",
        url: "https://api.example.com/customers?email=ana%40example.com",
        headers: { Authorization: SECRET, "content-type": "application/json" },
        body: '{"plan":"pro"}',
      },
      { retries: 0 }
    );
    const text = await response.text();
    expect(text).not.toContain(SECRET);
    expect(JSON.parse(text).data).toMatchObject({
      request: { headers: [{ name: "Authorization", value: "••••••" }, expect.anything()] },
      response: { status: 201, body: { id: "c_1" } },
      error: null,
    });
  });

  test("saves the answer as the step's sample and audits the host and status only", async () => {
    await post();

    expect(mocks.sampleUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { workflowId_source: { workflowId: WORKFLOW_ID, source: "call" } },
        update: { sample: { status: 201, contentType: "application/json", body: { id: "c_1" } } },
      })
    );
    expect(mocks.queueAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "testRequestSent",
        targetType: "workflow",
        targetId: WORKFLOW_ID,
        status: "success",
        newObject: { stepId: "call", host: "api.example.com", status: 201 },
      })
    );
    expect(JSON.stringify(mocks.queueAuditEvent.mock.calls)).not.toContain(SECRET);
  });

  test("a value typed in the draft is used for this call only and never stored", async () => {
    await post("call", {
      config: {
        ...definition.nodes[0].config,
        headers: [{ name: "Authorization", secret: true, value: "draft" }],
      },
    });

    expect(mocks.send.mock.calls[0][0].headers.Authorization).toBe("draft");
  });

  test("refuses an unauthenticated caller", async () => {
    mocks.getSession.mockResolvedValue(null);
    mocks.authenticateRequest.mockResolvedValue(null);

    expect((await post()).status).toBe(401);
    expect(mocks.send).not.toHaveBeenCalled();
  });

  test("needs write access to the workflow's workspace", async () => {
    mocks.requireV3WorkspaceAccess.mockResolvedValue(
      Response.json(
        { code: "forbidden" },
        { status: 403, headers: { "Content-Type": "application/problem+json" } }
      )
    );

    expect((await post()).status).toBe(403);
    expect(mocks.requireV3WorkspaceAccess.mock.calls[0][2]).toBe("readWrite");
    expect(mocks.send).not.toHaveBeenCalled();
  });

  test("answers an unknown workflow like a forbidden one", async () => {
    mocks.workflowFindUnique.mockResolvedValue(null);

    expect((await post()).status).toBe(403);
    expect(mocks.send).not.toHaveBeenCalled();
  });

  test("answers 404 for a step that is not an HTTP request", async () => {
    expect((await post("check")).status).toBe(404);
    expect((await post("nope")).status).toBe(404);
    expect(mocks.send).not.toHaveBeenCalled();
  });

  test("answers 429 once the caller's 30 a minute are spent, before reading anything", async () => {
    // Only this operation's own budget is spent; the general v3 budget still has room.
    mocks.applyRateLimit.mockImplementation((config: { namespace: string }) =>
      config.namespace === "api:v3:workflow-test-request"
        ? Promise.reject(new TooManyRequestsError("Maximum number of requests reached", 42))
        : Promise.resolve()
    );

    const response = await post();

    expect(response.status).toBe(429);
    expect(mocks.applyRateLimit).toHaveBeenCalledWith(
      expect.objectContaining({ namespace: "api:v3:workflow-test-request", allowedPerInterval: 30 }),
      "cm9zr52kh000508l8e3q7bw9j"
    );
    expect(mocks.workflowFindUnique).not.toHaveBeenCalled();
    expect(mocks.send).not.toHaveBeenCalled();
  });

  test("answers 400 for settings that can't be sent, without sending", async () => {
    mocks.loadSecrets.mockResolvedValue(new Map());

    const response = await post();

    expect(response.status).toBe(400);
    expect(await response.text()).toContain("Authorization");
    expect(mocks.send).not.toHaveBeenCalled();
  });

  test("answers 422 for an archived workflow", async () => {
    mocks.workflowFindUnique.mockResolvedValue({
      id: WORKFLOW_ID,
      workspaceId: WORKSPACE_ID,
      status: "archived",
      definition,
    });

    expect((await post()).status).toBe(422);
    expect(mocks.send).not.toHaveBeenCalled();
  });

  test("a target that answers with an error is still a 200, and no answer saves no sample", async () => {
    mocks.send.mockResolvedValue({ response: null, error: "The request timed out after 10 s", attempts: 1 });

    const response = await post();

    expect(response.status).toBe(200);
    expect((await response.json()).data).toMatchObject({
      response: null,
      error: "The request timed out after 10 s",
    });
    expect(mocks.sampleUpsert).not.toHaveBeenCalled();
  });
});
