import { beforeEach, describe, expect, test, vi } from "vitest";
import type { TAuthenticationApiKey } from "@formbricks/types/auth";
import type { TV3DocumentEnvelope, TV3DocumentPushResult } from "@/app/api/v3/documents/lib/envelope";
import { queueV3AuditLog } from "@/app/api/v3/lib/audit";
import { requireV3WorkspaceAccess } from "@/app/api/v3/lib/auth";
import type { TV3AuditLog } from "@/app/api/v3/lib/types";
import { queueAuditEvent } from "@/modules/ee/audit-logs/lib/handler";
import { getIsWorkflowsEnabled } from "@/modules/ee/license-check/lib/utils";
import { workflowDocumentAdapter } from "./document-adapter";

type TRow = {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  name: string;
  description: string | null;
  status: "draft" | "enabled" | "disabled" | "archived";
  workspaceId: string;
  createdBy: string | null;
  creator: null;
  definition: Record<string, unknown>;
  runs: never[];
  _count: { runs: number };
};

const { workflow, store } = vi.hoisted(() => ({
  workflow: { findUnique: vi.fn(), updateMany: vi.fn() },
  store: { row: null as unknown },
}));
vi.mock("@formbricks/database", () => ({
  prisma: {
    workflow,
    workflowVersion: {},
    workflowRun: {},
    survey: { findUnique: vi.fn(), findMany: vi.fn() },
    $transaction: (fn: (tx: unknown) => unknown) => fn({ workflow, workflowVersion: {} }),
  },
}));
vi.mock("@formbricks/logger", () => {
  const log = { warn: vi.fn(), error: vi.fn(), info: vi.fn() };
  return { logger: { withContext: vi.fn(() => log), ...log } };
});
vi.mock("@/app/api/v3/lib/auth", async (importOriginal) => {
  const { getV3AuthorizationActor, getV3SessionUserId } =
    await importOriginal<typeof import("@/app/api/v3/lib/auth")>();
  return { getV3AuthorizationActor, getV3SessionUserId, requireV3WorkspaceAccess: vi.fn() };
});
vi.mock("@/lib/survey/visibility/actor-context", () => ({ resolveSurveyActorContext: vi.fn() }));
vi.mock("@/lib/posthog", () => ({ capturePostHogEvent: vi.fn() }));
vi.mock("@/lib/authzed/scope-readiness", () => ({ isSurveyVisibilityReady: async () => false }));
vi.mock("@/lib/utils/helper", () => ({ getOrganizationIdFromWorkspaceId: vi.fn() }));
vi.mock("@/lib/workspace/service", () => ({ getWorkspaceMemberEmails: vi.fn() }));
vi.mock("@/modules/ee/license-check/lib/utils", () => ({ getIsWorkflowsEnabled: vi.fn() }));
vi.mock("@/modules/ee/audit-logs/lib/handler", () => ({ queueAuditEvent: vi.fn() }));

const workspaceId = "cm9zr4mps000008l8btfy1vtz";
const workflowId = "cm9zr4t2b000208l8h2m1aq3c";
const surveyId = "cm9zr4q7i000108l84gozfggr";
const pulledAt = "2026-06-12T09:30:00.000Z";

const definition = {
  schemaVersion: 1,
  trigger: {
    id: "trigger",
    type: "trigger",
    triggerType: "response.completed",
    config: { surveyId, endingCardIds: [] },
  },
  nodes: [
    {
      id: "send-email",
      type: "action",
      actionType: "send_email",
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

const makeRow = (overrides: Partial<TRow> = {}): TRow => ({
  id: workflowId,
  createdAt: new Date("2026-06-11T09:30:00.000Z"),
  updatedAt: new Date(pulledAt),
  name: "Notify team",
  description: "Tells support",
  status: "draft",
  workspaceId,
  createdBy: null,
  creator: null,
  definition,
  runs: [],
  _count: { runs: 0 },
  ...overrides,
});

const apiKeyAuth = {
  type: "apiKey",
  apiKeyId: "key_1",
  organizationId: "org_1",
  organizationAccess: { accessControl: { read: true, write: true } },
  workspacePermissions: [],
} as unknown as TAuthenticationApiKey;

const makeAuditLog = (): TV3AuditLog => ({
  action: "updated",
  targetType: "workflow",
  userId: "key_1",
  targetId: "unknown",
  organizationId: "org_1",
  status: "failure",
  oldObject: undefined,
  newObject: undefined,
  userType: "api",
  apiUrl: `https://app.formbricks.com/api/v3/workflows/${workflowId}/document`,
});

const pull = async (): Promise<TV3DocumentEnvelope> => {
  const response = await workflowDocumentAdapter.pull({
    id: workflowId,
    authentication: apiKeyAuth,
    requestId: "req_1",
  });
  expect(response.status).toBe(200);
  return ((await response.json()) as { data: TV3DocumentEnvelope }).data;
};

type TPushOptions = {
  document?: Record<string, unknown>;
  expectedUpdatedAt?: string;
  dryRun?: boolean;
  auditLog?: TV3AuditLog;
};

const push = (options: TPushOptions = {}) =>
  workflowDocumentAdapter.push({
    id: workflowId,
    document: options.document ?? { name: "Notify team", description: "Tells support", definition },
    expectedUpdatedAt: options.expectedUpdatedAt ?? pulledAt,
    dryRun: options.dryRun ?? false,
    confirmDestructive: false,
    authentication: apiKeyAuth,
    requestId: "req_1",
    auditLog: options.auditLog,
  });

const pushed = async (response: Response): Promise<TV3DocumentPushResult> => {
  expect(response.status).toBe(200);
  return ((await response.json()) as { data: TV3DocumentPushResult }).data;
};

const problem = async (response: Response) =>
  (await response.json()) as {
    status: number;
    code: string;
    details?: Record<string, string>;
    invalid_params?: Array<{ name: string; code?: string }>;
  };

/** The database as one row: `updateMany` is a real compare-and-set on `updatedAt`, like the SQL UPDATE. */
const useRow = (row: TRow | null) => {
  store.row = row;
  workflow.findUnique.mockImplementation(async () => store.row);
  workflow.updateMany.mockImplementation(
    async ({ where, data }: { where: { updatedAt: Date }; data: Partial<TRow> }) => {
      const current = store.row as TRow;
      if (current.updatedAt.getTime() !== where.updatedAt.getTime()) return { count: 0 };
      store.row = { ...current, ...data, updatedAt: new Date(current.updatedAt.getTime() + 60_000) };
      return { count: 1 };
    }
  );
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getIsWorkflowsEnabled).mockResolvedValue(true);
  vi.mocked(requireV3WorkspaceAccess).mockImplementation(async (_authentication, requested) =>
    requested === workspaceId
      ? { workspaceId, organizationId: "org_1" }
      : Response.json({ status: 403, code: "forbidden" }, { status: 403 })
  );
  useRow(makeRow());
});

describe("pull", () => {
  test("answers the editable state with the row's updatedAt, and nothing the server owns", async () => {
    const envelope = await pull();

    expect(envelope).toEqual({
      kind: "workflow",
      schemaVersion: 1,
      id: workflowId,
      workspaceId,
      updatedAt: pulledAt,
      document: { name: "Notify team", description: "Tells support", definition },
    });
    expect(requireV3WorkspaceAccess).toHaveBeenCalledWith(
      apiKeyAuth,
      workspaceId,
      "read",
      "req_1",
      expect.any(String)
    );
  });

  test("an id from another workspace answers like an unknown id", async () => {
    useRow(makeRow({ workspaceId: "cm9zr4mps000008l8btfy1vzz" }));
    const foreign = await workflowDocumentAdapter.pull({
      id: workflowId,
      authentication: apiKeyAuth,
      requestId: "req_1",
    });
    useRow(null);
    const unknown = await workflowDocumentAdapter.pull({
      id: workflowId,
      authentication: apiKeyAuth,
      requestId: "req_1",
    });

    expect(foreign.status).toBe(403);
    expect(unknown.status).toBe(403);
    expect((await problem(foreign)).code).toBe((await problem(unknown)).code);
  });

  test("a workspace without the workflows entitlement is refused", async () => {
    vi.mocked(getIsWorkflowsEnabled).mockResolvedValue(false);

    const response = await workflowDocumentAdapter.pull({
      id: workflowId,
      authentication: apiKeyAuth,
      requestId: "req_1",
    });

    expect(response.status).toBe(403);
  });
});

describe("push", () => {
  test("a pulled document pushed back unchanged is a no-op: no changes, no write, no audit entry", async () => {
    const { document, updatedAt } = await pull();
    const auditLog = makeAuditLog();

    const result = await pushed(await push({ document, expectedUpdatedAt: updatedAt, auditLog }));

    expect(result.changes).toEqual([]);
    expect(result.dryRun).toBe(false);
    expect(result.envelope.updatedAt).toBe(updatedAt);
    expect(workflow.updateMany).not.toHaveBeenCalled();

    await queueV3AuditLog(auditLog, "req_1", { error: vi.fn() } as never);
    expect(queueAuditEvent).not.toHaveBeenCalled();
  });

  test("a pushed document with the keys in another order is also a no-op", async () => {
    const reordered = JSON.parse(
      JSON.stringify({ definition, description: "Tells support", name: "Notify team" })
    );
    reordered.definition = Object.fromEntries(Object.entries(reordered.definition).reverse());

    const result = await pushed(await push({ document: reordered }));

    expect(result.changes).toEqual([]);
    expect(workflow.updateMany).not.toHaveBeenCalled();
  });

  test("replaces the state: an omitted description resets, and only what changed is written", async () => {
    const result = await pushed(await push({ document: { name: "Notify team", definition } }));

    expect(result.changes).toEqual([{ path: "description", change: "changed" }]);
    expect(result.envelope.document).toMatchObject({ description: null });
    expect(workflow.updateMany).toHaveBeenCalledWith({
      where: { id: workflowId, workspaceId, updatedAt: new Date(pulledAt) },
      data: { description: null },
    });
    expect(result.envelope.updatedAt).toBe("2026-06-12T09:31:00.000Z");
  });

  test("names the nodes that changed, and records the update with send_email PII masked", async () => {
    const edited = structuredClone(definition);
    edited.nodes[0].config.subject = "Thank you";
    const auditLog = makeAuditLog();

    const result = await pushed(
      await push({
        document: { name: "Notify team", description: "Tells support", definition: edited },
        auditLog,
      })
    );

    expect(result.changes).toEqual([{ path: "definition.nodes[send-email]", change: "changed" }]);
    expect(auditLog.targetId).toBe(workflowId);
    const snapshots = JSON.stringify([auditLog.oldObject, auditLog.newObject]);
    expect(snapshots).not.toContain("support@example.com");
    expect(snapshots).not.toContain("Thank you");
    expect(snapshots).toContain("[redacted:");

    auditLog.status = "success";
    await queueV3AuditLog(auditLog, "req_1", { error: vi.fn() } as never);
    expect(queueAuditEvent).toHaveBeenCalledTimes(1);
  });

  test("a push never touches status, and refuses a document that carries one", async () => {
    const response = await push({ document: { name: "x", status: "enabled", definition } });

    expect(response.status).toBe(422);
    const body = await problem(response);
    expect(body.invalid_params).toEqual([
      expect.objectContaining({ name: "status", code: "unsupported_field" }),
    ]);
    expect(workflow.findUnique).not.toHaveBeenCalled();
    expect(workflow.updateMany).not.toHaveBeenCalled();
  });

  test("refuses a key the definition schema would drop silently, naming its path", async () => {
    const withTypo = structuredClone(definition) as Record<string, unknown>;
    (withTypo.nodes as Array<{ config: Record<string, unknown> }>)[0].config.recipients = ["a@example.com"];

    const response = await push({ document: { name: "x", definition: withTypo } });

    expect(response.status).toBe(422);
    expect((await problem(response)).invalid_params).toEqual([
      expect.objectContaining({ name: "definition.nodes.0.config.recipients" }),
    ]);
    expect(workflow.updateMany).not.toHaveBeenCalled();
  });

  test("answers 409 with both timestamps when the workflow changed since the pull", async () => {
    useRow(makeRow({ updatedAt: new Date("2026-06-12T09:45:00.000Z") }));

    const response = await push({ document: { name: "Renamed", description: "Tells support", definition } });

    expect(response.status).toBe(409);
    expect((await problem(response)).details).toEqual({
      expectedUpdatedAt: pulledAt,
      currentUpdatedAt: "2026-06-12T09:45:00.000Z",
    });
    expect(workflow.updateMany).not.toHaveBeenCalled();
  });

  test("two pushes from the same pull: the first wins, the second is told the new updatedAt", async () => {
    const first = await push({ document: { name: "First", description: "Tells support", definition } });
    const second = await push({ document: { name: "Second", description: "Tells support", definition } });

    expect(first.status).toBe(200);
    expect(second.status).toBe(409);
    expect((await problem(second)).details).toEqual({
      expectedUpdatedAt: pulledAt,
      currentUpdatedAt: "2026-06-12T09:31:00.000Z",
    });
    expect((store.row as TRow).name).toBe("First");
  });

  test("a push whose early read was stale is turned away by the write itself, not overwritten", async () => {
    // The loser read the row at its pulled updatedAt, then a concurrent push wrote before its UPDATE ran.
    const readBeforeTheWinner = makeRow();
    store.row = makeRow({ name: "Winner", updatedAt: new Date("2026-06-12T09:31:00.000Z") });
    workflow.findUnique.mockReset();
    workflow.findUnique.mockResolvedValueOnce(readBeforeTheWinner).mockImplementation(async () => store.row);

    const loser = await push({ document: { name: "Loser", description: "Tells support", definition } });

    expect(workflow.updateMany).toHaveBeenCalledTimes(1);
    expect(loser.status).toBe(409);
    expect((await problem(loser)).details).toEqual({
      expectedUpdatedAt: pulledAt,
      currentUpdatedAt: "2026-06-12T09:31:00.000Z",
    });
    expect((store.row as TRow).name).toBe("Winner");
  });

  test("an enabled workflow keeps its definition, but may be renamed", async () => {
    useRow(makeRow({ status: "enabled" }));
    const edited = structuredClone(definition);
    edited.edges = [];

    const refused = await push({
      document: { name: "Notify team", description: "Tells support", definition: edited },
    });
    expect(refused.status).toBe(422);
    expect((await problem(refused)).code).toBe("invalid_workflow_state");
    expect(workflow.updateMany).not.toHaveBeenCalled();

    const renamed = await pushed(
      await push({ document: { name: "Renamed", description: "Tells support", definition } })
    );
    expect(renamed.changes).toEqual([{ path: "name", change: "changed" }]);
    expect(workflow.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { name: "Renamed" } }));
  });

  test("an archived workflow is read-only", async () => {
    useRow(makeRow({ status: "archived" }));

    const response = await push({ document: { name: "Renamed", definition } });

    expect(response.status).toBe(422);
    expect((await problem(response)).code).toBe("invalid_workflow_state");
    expect(workflow.updateMany).not.toHaveBeenCalled();
  });

  test("a caller without write access, or an unknown id, is refused before anything is written", async () => {
    vi.mocked(requireV3WorkspaceAccess).mockResolvedValue(
      Response.json({ status: 403, code: "forbidden" }, { status: 403 })
    );
    expect((await push({ document: { name: "x", definition } })).status).toBe(403);

    vi.mocked(requireV3WorkspaceAccess).mockResolvedValue({ workspaceId, organizationId: "org_1" });
    useRow(null);
    expect((await push({ document: { name: "x", definition } })).status).toBe(403);
    expect(workflow.updateMany).not.toHaveBeenCalled();
  });

  test("a dry run runs every check, reports the changes, and writes and records nothing", async () => {
    const auditLog = makeAuditLog();

    const result = await pushed(
      await push({
        document: { name: "Renamed", description: "Tells support", definition },
        dryRun: true,
        auditLog,
      })
    );

    expect(result.dryRun).toBe(true);
    expect(result.changes).toEqual([{ path: "name", change: "changed" }]);
    expect(result.envelope.document).toMatchObject({ name: "Renamed" });
    expect(result.envelope.updatedAt).toBe(pulledAt);
    expect(workflow.updateMany).not.toHaveBeenCalled();
    expect(auditLog.targetId).toBe("unknown");

    await queueV3AuditLog(auditLog, "req_1", { error: vi.fn() } as never);
    expect(queueAuditEvent).not.toHaveBeenCalled();
  });

  test("a dry run that finds a problem answers the same problem a real push would", async () => {
    const cases: Array<[string, () => void, TPushOptions]> = [
      [
        "stale",
        () => useRow(makeRow({ updatedAt: new Date("2026-06-12T09:45:00.000Z") })),
        { document: { name: "Renamed", definition } },
      ],
      [
        "archived",
        () => useRow(makeRow({ status: "archived" })),
        { document: { name: "Renamed", definition } },
      ],
      ["invalid", () => useRow(makeRow()), { document: { name: "Renamed", definition, status: "draft" } }],
    ];

    for (const [, arrange, options] of cases) {
      arrange();
      const real = await push(options);
      const dry = await push({ ...options, dryRun: true });

      expect(dry.status).toBe(real.status);
      expect(await problem(dry)).toEqual(await problem(real));
    }
  });
});
