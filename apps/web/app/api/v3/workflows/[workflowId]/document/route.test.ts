import { beforeEach, describe, expect, test, vi } from "vitest";
import { queueV3AuditLog } from "@/app/api/v3/lib/audit";
import type { TV3AuditLog } from "@/app/api/v3/lib/types";
import { queueAuditEvent } from "@/modules/ee/audit-logs/lib/handler";

const { push, pull } = vi.hoisted(() => ({ push: vi.fn(), pull: vi.fn() }));
vi.mock("../../lib/document-adapter", () => ({ workflowDocumentAdapter: { push, pull } }));
// The wrapper's own behaviour (auth, parsing, audit queueing) is tested in lib/api-wrapper; here the route's
// handler is called directly with what the wrapper would hand it.
vi.mock("@/app/api/v3/lib/api-wrapper", () => ({
  withV3ApiWrapper: (config: { handler: unknown }) => config.handler,
}));
vi.mock("@/app/api/v3/lib/audit", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/app/api/v3/lib/audit")>();
  return { ...actual, skipV3AuditLog: vi.fn(actual.skipV3AuditLog) };
});
vi.mock("@/modules/ee/audit-logs/lib/handler", () => ({ queueAuditEvent: vi.fn() }));
vi.mock("@/app/lib/api/with-api-logging", () => ({ buildAuditLogBaseObject: vi.fn() }));
vi.mock("@formbricks/logger", () => ({ logger: { withContext: vi.fn() } }));

const workflowId = "cm9zr4t2b000208l8h2m1aq3c";
const updatedAt = "2026-06-12T09:30:00.000Z";

type TPut = (args: unknown) => Promise<Response>;

const loadRoute = async () => (await import("./route")) as unknown as { GET: TPut; PUT: TPut };

const makeAuditLog = (): TV3AuditLog =>
  ({ action: "updated", targetType: "workflow", status: "failure" }) as unknown as TV3AuditLog;

const callPut = async (body: Record<string, unknown>, auditLog: TV3AuditLog) => {
  const { PUT } = await loadRoute();
  return PUT({
    parsedInput: {
      params: { workflowId },
      body: { schemaVersion: 1, expectedUpdatedAt: updatedAt, document: { name: "x" }, ...body },
    },
    authentication: { apiKeyId: "key_1" },
    auditLog,
    requestId: "req_1",
    instance: `/api/v3/workflows/${workflowId}/document`,
  });
};

beforeEach(() => {
  vi.clearAllMocks();
  push.mockResolvedValue(new Response(null, { status: 200 }));
  pull.mockResolvedValue(new Response(null, { status: 200 }));
});

describe("PUT /api/v3/workflows/{workflowId}/document", () => {
  test("a push hands the wrapper's audit entry to the adapter, and it is queued", async () => {
    const auditLog = makeAuditLog();

    await callPut({}, auditLog);

    expect(push).toHaveBeenCalledWith(
      expect.objectContaining({ id: workflowId, dryRun: false, confirmDestructive: false, auditLog })
    );
    await queueV3AuditLog(auditLog, "req_1", { error: vi.fn() } as never);
    expect(queueAuditEvent).toHaveBeenCalledTimes(1);
  });

  test("a dry run passes no audit entry and drops the wrapper's, so nothing is queued", async () => {
    const auditLog = makeAuditLog();

    await callPut({ dryRun: true }, auditLog);

    expect(push).toHaveBeenCalledWith(expect.objectContaining({ dryRun: true, auditLog: undefined }));
    await queueV3AuditLog(auditLog, "req_1", { error: vi.fn() } as never);
    expect(queueAuditEvent).not.toHaveBeenCalled();
  });
});

describe("GET /api/v3/workflows/{workflowId}/document", () => {
  test("pulls by the path's id", async () => {
    const { GET } = await loadRoute();

    await GET({
      parsedInput: { params: { workflowId } },
      authentication: { apiKeyId: "key_1" },
      requestId: "req_1",
      instance: "/x",
    });

    expect(pull).toHaveBeenCalledWith(expect.objectContaining({ id: workflowId, requestId: "req_1" }));
  });
});
