import { beforeEach, describe, expect, test, vi } from "vitest";
import type { TV3Authentication } from "@/app/api/v3/lib/types";
import { getOrganizationIdFromWorkspaceId } from "@/lib/utils/helper";
import { queueAuditEvent } from "@/modules/ee/audit-logs/lib/handler";
import { buildRecordSecretHeaderChanges } from "./secret-audit";

vi.mock("@/modules/ee/audit-logs/lib/handler", () => ({ queueAuditEvent: vi.fn() }));
vi.mock("@/lib/utils/helper", () => ({ getOrganizationIdFromWorkspaceId: vi.fn() }));
vi.mock("@formbricks/logger", () => ({
  logger: { withContext: vi.fn(() => ({ warn: vi.fn(), error: vi.fn() })) },
}));

const session = { user: { id: "user_1" }, expires: "2099-01-01" } as unknown as TV3Authentication;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getOrganizationIdFromWorkspaceId).mockResolvedValue("org_1");
});

describe("buildRecordSecretHeaderChanges", () => {
  test("queues one audit event per stored secret header, naming the header only", async () => {
    const record = buildRecordSecretHeaderChanges(session, "req_1", "/api/v3/workflows/wf_1");

    await record({
      workflowId: "wf_1",
      workspaceId: "ws_1",
      changes: [
        { stepId: "call", headerName: "Authorization", change: "set" },
        { stepId: "call", headerName: "X-Api-Key", change: "replaced" },
      ],
    });

    const events = vi.mocked(queueAuditEvent).mock.calls.map(([event]) => event);
    expect(events).toEqual([
      expect.objectContaining({
        action: "secretHeaderSet",
        targetType: "workflow",
        targetId: "wf_1",
        organizationId: "org_1",
        userId: "user_1",
        userType: "user",
        status: "success",
        newObject: { stepId: "call", headerName: "Authorization" },
      }),
      expect.objectContaining({
        action: "secretHeaderReplaced",
        newObject: { stepId: "call", headerName: "X-Api-Key" },
      }),
    ]);
  });
});
