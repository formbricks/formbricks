import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { SAME_ORIGIN_HEADERS } from "@/app/api/v3/lib/test-utils";
import { PUT } from "./route";

/** Setting an HTTP request step's expected response body (ADR 0054): who may, which step, what is stored and audited. */
const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  authenticateRequest: vi.fn(),
  applyRateLimit: vi.fn(),
  requireV3WorkspaceAccess: vi.fn(),
  getIsWorkflowsEnabled: vi.fn(),
  workflowFindUnique: vi.fn(),
  sampleUpsert: vi.fn(),
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
    workflowSample: { upsert: mocks.sampleUpsert },
  },
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
        url: "https://api.example.com/tickets",
        queryParameters: [],
        headers: [],
        responseMode: "wait",
        continueOnError: false,
      },
    },
    {
      id: "mail",
      type: "action",
      actionType: "send_email",
      config: { to: "a@example.com", from: "b@example.com", replyTo: [], subject: "S", body: "B" },
    },
  ],
  edges: [
    { id: "e1", source: "trigger", target: "call" },
    { id: "e2", source: "call", target: "mail" },
  ],
  entryNodeId: "trigger",
};

const put = (stepId: string, body: unknown) =>
  PUT(
    new NextRequest(`http://localhost/api/v3/workflows/${WORKFLOW_ID}/steps/${stepId}/expected-response`, {
      method: "PUT",
      body: JSON.stringify(body),
      headers: { ...SAME_ORIGIN_HEADERS, "Content-Type": "application/json" },
    }),
    { params: Promise.resolve({ workflowId: WORKFLOW_ID, stepId }) }
  );

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
  mocks.sampleUpsert.mockImplementation(({ create }) => ({
    source: create.source,
    sample: create.sample,
    updatedAt: new Date("2026-11-17T08:00:00.000Z"),
  }));
});

describe("PUT /api/v3/workflows/{workflowId}/steps/{stepId}/expected-response", () => {
  test("stores the body as the step's expected response body, in a test response's shape", async () => {
    const response = await put("call", { body: { ticketId: "tk_1" } });

    expect(response.status).toBe(200);
    // The step id row, which the Variable picker and Test runs read; never the `:last_test` one.
    expect(mocks.sampleUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { workflowId_source: { workflowId: WORKFLOW_ID, source: "call" } },
        update: {
          sample: {
            status: 200,
            contentType: "application/json",
            body: { ticketId: "tk_1" },
            bodyTruncated: false,
          },
        },
      })
    );
    // The Variables under the paths a later step reads.
    expect((await response.json()).data).toEqual({
      workflowId: WORKFLOW_ID,
      stepId: "call",
      body: { ticketId: "tk_1" },
      variables: {
        variables: [{ path: "steps.call.body.ticketId", valueType: "string" }],
        notSupported: [],
        truncated: false,
      },
      updatedAt: "2026-11-17T08:00:00.000Z",
    });
  });

  test("is audited as an update of the workflow with the step id, never the body", async () => {
    await put("call", { body: { email: "jane@example.com" } });

    expect(mocks.queueAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "updated",
        targetType: "workflow",
        targetId: WORKFLOW_ID,
        status: "success",
        newObject: { expectedResponse: "call" },
      })
    );
    expect(JSON.stringify(mocks.queueAuditEvent.mock.calls)).not.toContain("jane@example.com");
  });

  test("refuses a body over 100 KB with 413", async () => {
    expect((await put("call", { body: { blob: "x".repeat(101 * 1024) } })).status).toBe(413);
    expect(mocks.sampleUpsert).not.toHaveBeenCalled();
  });

  test("refuses a step that isn't an HTTP request in the draft", async () => {
    expect((await put("mail", { body: { a: 1 } })).status).toBe(404);
    expect((await put("gone", { body: { a: 1 } })).status).toBe(404);
    expect(mocks.sampleUpsert).not.toHaveBeenCalled();
  });

  test("refuses a body that isn't a JSON object", async () => {
    expect((await put("call", { body: ["a"] })).status).toBe(400);
    expect(mocks.sampleUpsert).not.toHaveBeenCalled();
  });

  test("refuses an archived workflow", async () => {
    mocks.workflowFindUnique.mockResolvedValue({
      id: WORKFLOW_ID,
      workspaceId: WORKSPACE_ID,
      status: "archived",
      definition,
    });

    expect((await put("call", { body: { a: 1 } })).status).toBe(422);
    expect(mocks.sampleUpsert).not.toHaveBeenCalled();
  });

  test("needs write access", async () => {
    mocks.requireV3WorkspaceAccess.mockResolvedValue(
      Response.json(
        { code: "forbidden" },
        { status: 403, headers: { "Content-Type": "application/problem+json" } }
      )
    );

    expect((await put("call", { body: { a: 1 } })).status).toBe(403);
    expect(mocks.requireV3WorkspaceAccess.mock.calls[0][2]).toBe("readWrite");
    expect(mocks.sampleUpsert).not.toHaveBeenCalled();
  });
});
