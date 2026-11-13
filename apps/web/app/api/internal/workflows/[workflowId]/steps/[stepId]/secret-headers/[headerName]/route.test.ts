import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { TooManyRequestsError } from "@formbricks/types/errors";
import { collectWorkflowSecretIds } from "@formbricks/workflows";
import { symmetricEncrypt } from "@/lib/crypto";
import { loadWorkflowSecretValues } from "@/modules/ee/workflows/lib/secret-headers/workflow-secret-store";
import { PUT } from "./route";

/**
 * Replace on a secret header (ADR 0043) behind the route: authentication, write access, the step and
 * header lookup in the draft and the enabled version, the encrypted row written in place (a real store
 * over an in-memory table), the draft pointer for a first value, and the audit event.
 */
const KEY = vi.hoisted(() => "0123456789abcdef0123456789abcdef");

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  authenticateRequest: vi.fn(),
  applyRateLimit: vi.fn(),
  requireV3WorkspaceAccess: vi.fn(),
  getIsWorkflowsEnabled: vi.fn(),
  workflowFindUnique: vi.fn(),
  workflowUpdateMany: vi.fn(),
  versionFindFirst: vi.fn(),
  queueAuditEvent: vi.fn(),
  logError: vi.fn(),
  logWarn: vi.fn(),
  logInfo: vi.fn(),
  secrets: new Map<string, { workflowId: string; workspaceId: string; value: string }>(),
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
vi.mock("@/lib/constants", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/constants")>()),
  ENCRYPTION_KEY: KEY,
}));
vi.mock("@formbricks/database", () => {
  type TWhere = { id?: string | { in: string[] }; workflowId: string; workspaceId: string };
  const matches = (id: string, row: { workflowId: string; workspaceId: string }, where: TWhere) =>
    row.workflowId === where.workflowId &&
    row.workspaceId === where.workspaceId &&
    (typeof where.id === "string" ? where.id === id : (where.id?.in.includes(id) ?? true));
  return {
    prisma: {
      workflow: { findUnique: mocks.workflowFindUnique, updateMany: mocks.workflowUpdateMany },
      workflowVersion: { findFirst: mocks.versionFindFirst },
      workflowSecret: {
        create: vi.fn(
          async ({ data }: { data: { workflowId: string; workspaceId: string; value: string } }) => {
            const id = `sec_new_${(mocks.secrets.size + 1).toString()}`;
            mocks.secrets.set(id, data);
            return { id };
          }
        ),
        updateMany: vi.fn(async ({ where, data }: { where: TWhere; data: { value: string } }) => {
          let count = 0;
          for (const [id, row] of mocks.secrets) {
            if (matches(id, row, where)) {
              mocks.secrets.set(id, { ...row, value: data.value });
              count += 1;
            }
          }
          return { count };
        }),
        findMany: vi.fn(async ({ where }: { where: TWhere }) =>
          [...mocks.secrets]
            .filter(([id, row]) => matches(id, row, where))
            .map(([id, row]) => ({ id, value: row.value }))
        ),
      },
    },
  };
});
vi.mock("@/modules/ee/audit-logs/lib/handler", () => ({ queueAuditEvent: mocks.queueAuditEvent }));
vi.mock("@/lib/utils/helper", () => ({
  getOrganizationIdFromWorkspaceId: vi.fn().mockResolvedValue("org_1"),
}));
vi.mock("@/lib/posthog", () => ({ capturePostHogEvent: vi.fn() }));
vi.mock("@formbricks/logger", () => {
  const log = { error: mocks.logError, warn: mocks.logWarn, info: mocks.logInfo, debug: vi.fn() };
  return { logger: { ...log, withContext: vi.fn(() => log) } };
});

const WORKFLOW_ID = "cm9zr4t2b000208l8h2m1aq3c";
const WORKSPACE_ID = "cm9zr4mps000008l8btfy1vtz";
const NEW_VALUE = "Bearer sk_live_rotated";

const definitionWith = (headers: unknown[]) => ({
  schemaVersion: 1,
  entryNodeId: "trigger",
  trigger: { id: "trigger", type: "trigger", triggerType: "webhook", config: {} },
  nodes: [
    {
      id: "call",
      type: "action",
      actionType: "http_request",
      config: {
        method: "POST",
        url: "https://api.example.com/customers",
        queryParameters: [],
        headers,
        responseMode: "wait",
        continueOnError: false,
      },
    },
    { id: "check", type: "if_else", config: { condition: { id: "g", connector: "and", conditions: [] } } },
  ],
  edges: [{ id: "e1", source: "trigger", target: "call" }],
});

const enabledDefinition = definitionWith([
  { name: "Authorization", secret: true, secretId: "sec_1" },
  { name: "X-Team", value: "growth" },
]);

const workflowRow = (overrides: Record<string, unknown> = {}) => ({
  id: WORKFLOW_ID,
  workspaceId: WORKSPACE_ID,
  status: "enabled",
  definition: enabledDefinition,
  versions: [{ definition: enabledDefinition }],
  ...overrides,
});

const put = (headerName = "authorization", body: unknown = { value: NEW_VALUE }, stepId = "call") =>
  PUT(
    new NextRequest(
      `http://localhost/api/internal/workflows/${WORKFLOW_ID}/steps/${stepId}/secret-headers/${headerName}`,
      { method: "PUT", body: JSON.stringify(body), headers: { "Content-Type": "application/json" } }
    ),
    { params: Promise.resolve({ workflowId: WORKFLOW_ID, stepId, headerName }) } as never
  );

/** What a run of this definition would send: the runner loads its secrets exactly like this. */
const valuesFor = (definition: object) =>
  loadWorkflowSecretValues({
    workflowId: WORKFLOW_ID,
    workspaceId: WORKSPACE_ID,
    secretIds: collectWorkflowSecretIds(definition as Parameters<typeof collectWorkflowSecretIds>[0]),
  });

/** Everything the request could have leaked the value through. */
const sinks = () =>
  JSON.stringify([
    mocks.queueAuditEvent.mock.calls,
    mocks.logError.mock.calls,
    mocks.logWarn.mock.calls,
    mocks.logInfo.mock.calls,
  ]);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.secrets.clear();
  mocks.secrets.set("sec_1", {
    workflowId: WORKFLOW_ID,
    workspaceId: WORKSPACE_ID,
    value: symmetricEncrypt("Bearer sk_live_old", KEY),
  });
  mocks.getSession.mockResolvedValue({ user: { id: "cm9zr52kh000508l8e3q7bw9j" }, expires: "2099-01-01" });
  mocks.applyRateLimit.mockResolvedValue(undefined);
  mocks.requireV3WorkspaceAccess.mockResolvedValue({ workspaceId: WORKSPACE_ID, organizationId: "org_1" });
  mocks.getIsWorkflowsEnabled.mockResolvedValue(true);
  mocks.workflowFindUnique.mockResolvedValue(workflowRow());
  // The latest version of whatever row the test set up.
  mocks.versionFindFirst.mockImplementation(async () => {
    const row = (await mocks.workflowFindUnique()) as { versions?: { definition: unknown }[] } | null;
    return row?.versions?.[0] ?? null;
  });
  mocks.workflowUpdateMany.mockResolvedValue({ count: 1 });
});

describe("PUT /api/internal/workflows/{workflowId}/steps/{stepId}/secret-headers/{headerName}", () => {
  test("overwrites the enabled workflow's secret in place, so its next run sends the new value", async () => {
    const response = await put();

    expect(response.status).toBe(204);
    expect(await response.text()).toBe("");
    expect([...mocks.secrets.keys()]).toEqual(["sec_1"]);
    expect(await valuesFor(enabledDefinition)).toEqual(new Map([["sec_1", NEW_VALUE]]));
    // The enabled workflow is not re-enabled and its definition is not touched.
    expect(mocks.workflowUpdateMany).not.toHaveBeenCalled();
  });

  test("audits secretHeaderReplaced with the step and header name, never the value", async () => {
    await put();

    expect(mocks.queueAuditEvent).toHaveBeenCalledTimes(1);
    expect(mocks.queueAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "secretHeaderReplaced",
        targetType: "workflow",
        targetId: WORKFLOW_ID,
        status: "success",
        newObject: { stepId: "call", headerName: "Authorization" },
      })
    );
    expect(sinks()).not.toContain(NEW_VALUE);
    expect(sinks()).not.toContain("sk_live_rotated");
  });

  test("replaces a header that is only in the enabled version, after the draft dropped it", async () => {
    mocks.workflowFindUnique.mockResolvedValue(
      workflowRow({ status: "enabled", definition: definitionWith([{ name: "X-Team", value: "growth" }]) })
    );

    expect((await put()).status).toBe(204);
    expect(await valuesFor(enabledDefinition)).toEqual(new Map([["sec_1", NEW_VALUE]]));
  });

  test("a header with no value yet gets a new row, pointed at from the draft only", async () => {
    const draft = definitionWith([{ name: "X-Api-Key", secret: true }]);
    mocks.workflowFindUnique.mockResolvedValue(
      workflowRow({ status: "disabled", definition: draft, versions: [] })
    );

    expect((await put("x-api-key")).status).toBe(204);

    const [newId] = [...mocks.secrets.keys()].filter((id) => id !== "sec_1");
    const update = mocks.workflowUpdateMany.mock.calls[0][0];
    expect(update.where).toEqual({ id: WORKFLOW_ID, workspaceId: WORKSPACE_ID });
    expect(update.data.definition.nodes[0].config.headers).toEqual([
      { name: "X-Api-Key", secret: true, secretId: newId },
    ]);
    expect(await valuesFor(update.data.definition)).toEqual(new Map([[newId, NEW_VALUE]]));
    expect(mocks.queueAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "secretHeaderSet",
        newObject: { stepId: "call", headerName: "X-Api-Key" },
      })
    );
  });

  test("answers 404 for a step that is not an HTTP request or a header that is not secret", async () => {
    for (const [headerName, stepId] of [
      ["Authorization", "check"],
      ["Authorization", "missing"],
      ["X-Team", "call"],
      ["X-Unknown", "call"],
    ]) {
      const response = await put(headerName, { value: NEW_VALUE }, stepId);
      expect(response.status).toBe(404);
    }
    expect(await valuesFor(enabledDefinition)).toEqual(new Map([["sec_1", "Bearer sk_live_old"]]));
  });

  test.each([
    ["an empty value", { value: "" }],
    ["a line break", { value: "Bearer a\r\nX-Evil: 1" }],
    ["a value over 8 KB", { value: "a".repeat(8 * 1024 + 1) }],
    ["an unknown field", { value: "ok", secretId: "sec_other" }],
  ])("refuses %s with 400 and stores nothing", async (_, body) => {
    expect((await put("authorization", body)).status).toBe(400);
    expect(await valuesFor(enabledDefinition)).toEqual(new Map([["sec_1", "Bearer sk_live_old"]]));
  });

  test("an archived workflow is read-only", async () => {
    mocks.workflowFindUnique.mockResolvedValue(workflowRow({ status: "archived" }));

    expect((await put()).status).toBe(422);
    expect(await valuesFor(enabledDefinition)).toEqual(new Map([["sec_1", "Bearer sk_live_old"]]));
  });

  test("refuses an unauthenticated caller", async () => {
    mocks.getSession.mockResolvedValue(null);
    mocks.authenticateRequest.mockResolvedValue(null);

    expect((await put()).status).toBe(401);
    expect(mocks.workflowFindUnique).not.toHaveBeenCalled();
  });

  test("is session-only: an API key is refused with 401 and stores nothing", async () => {
    mocks.getSession.mockResolvedValue(null);
    mocks.authenticateRequest.mockResolvedValue({
      type: "apiKey",
      apiKeyId: "key_1",
      organizationId: "org_1",
      organizationAccess: { accessControl: { read: true, write: true } },
      workspacePermissions: [{ workspaceId: WORKSPACE_ID, workspaceName: "W", permission: "write" }],
    });

    expect((await put()).status).toBe(401);
    expect(await valuesFor(enabledDefinition)).toEqual(new Map([["sec_1", "Bearer sk_live_old"]]));
  });

  test("refuses read-only access and stores nothing", async () => {
    mocks.requireV3WorkspaceAccess.mockResolvedValue(
      Response.json(
        { code: "forbidden" },
        { status: 403, headers: { "Content-Type": "application/problem+json" } }
      )
    );

    expect((await put()).status).toBe(403);
    expect(mocks.requireV3WorkspaceAccess.mock.calls[0][2]).toBe("readWrite");
    expect(await valuesFor(enabledDefinition)).toEqual(new Map([["sec_1", "Bearer sk_live_old"]]));
  });

  test("answers a workflow of another workspace like an unknown one", async () => {
    mocks.workflowFindUnique.mockResolvedValue(null);

    const response = await put();

    expect(response.status).toBe(403);
    expect(mocks.requireV3WorkspaceAccess).not.toHaveBeenCalled();
    expect(await valuesFor(enabledDefinition)).toEqual(new Map([["sec_1", "Bearer sk_live_old"]]));
  });

  test("is rate limited like other workflow writes", async () => {
    mocks.applyRateLimit.mockRejectedValue(new TooManyRequestsError("Maximum number of requests reached"));

    expect((await put()).status).toBe(429);
    expect(await valuesFor(enabledDefinition)).toEqual(new Map([["sec_1", "Bearer sk_live_old"]]));
  });
});
