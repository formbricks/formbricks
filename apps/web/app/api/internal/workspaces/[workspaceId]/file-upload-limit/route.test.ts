import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { AuthorizationError, ResourceNotFoundError } from "@formbricks/types/errors";
import { GET } from "./route";

const mocks = vi.hoisted(() => ({
  assertCan: vi.fn(),
  getSession: vi.fn(),
  getOrganization: vi.fn(),
  resolveWorkspace: vi.fn(),
  queueAuditEvent: vi.fn(),
}));

vi.mock("@/lib/authorization", () => ({ assertCan: mocks.assertCan, can: vi.fn() }));
vi.mock("@/app/api/v3/lib/workspace-context", () => ({ resolveV3WorkspaceContext: mocks.resolveWorkspace }));
vi.mock("@/lib/organization/service", () => ({ getOrganization: mocks.getOrganization }));
vi.mock("@/modules/auth/lib/session", () => ({ getSession: mocks.getSession }));
vi.mock("@/app/api/v1/auth", () => ({ authenticateRequest: vi.fn() }));
vi.mock("@/modules/core/rate-limit/helpers", () => ({
  applyRateLimit: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/modules/ee/audit-logs/lib/handler", () => ({ queueAuditEvent: mocks.queueAuditEvent }));
vi.mock("@formbricks/logger", () => ({
  logger: { withContext: vi.fn(() => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn() })), error: vi.fn() },
}));
vi.mock("server-only", () => ({}));

const ORG_ID = "clorg11111111111111111111";
const WORKSPACE_ID = "clws111111111111111111111";
const USER_ID = "cluser1111111111111111111";

const organization = (workspaces: number | null) => ({
  id: ORG_ID,
  billing: {
    stripeCustomerId: "cus_secret",
    limits: { workspaces, monthly: { responses: 1500, workflowRuns: 100 } },
    stripe: { plan: "pro", subscriptionId: "sub_secret" },
  },
});

const get = (id = WORKSPACE_ID) =>
  GET(new NextRequest(`http://localhost/api/internal/workspaces/${id}/file-upload-limit`), {
    params: Promise.resolve({ workspaceId: id }),
  } as never);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getSession.mockResolvedValue({ user: { id: USER_ID } });
  mocks.resolveWorkspace.mockImplementation(async (workspaceId: string) => ({
    workspaceId,
    organizationId: ORG_ID,
  }));
  mocks.assertCan.mockResolvedValue(undefined);
  mocks.getOrganization.mockResolvedValue(organization(3));
});

describe("GET /api/internal/workspaces/{workspaceId}/file-upload-limit", () => {
  test("answers a workspace reader with the plan's cap and nothing of the billing record", async () => {
    const response = await get();

    expect(response.status).toBe(200);
    expect((await response.json()).data).toEqual({ maxFileSizeMB: 1024 });
    expect(mocks.assertCan).toHaveBeenCalledWith({ type: "user", id: USER_ID }, "workspace.read", {
      type: "workspace",
      id: WORKSPACE_ID,
    });
    expect(mocks.getOrganization).toHaveBeenCalledWith(ORG_ID);
  });

  test.each([
    ["an unlimited plan", null, 1024],
    ["a plan with several workspaces", 3, 1024],
    ["a single-workspace plan", 1, 10],
  ])("caps %s at %s workspaces to the right size", async (_label, workspaces, maxFileSizeMB) => {
    mocks.getOrganization.mockResolvedValue(organization(workspaces));

    expect((await (await get()).json()).data).toEqual({ maxFileSizeMB });
  });

  test("refuses a caller who can't read the workspace with 403, and reads no billing", async () => {
    mocks.assertCan.mockRejectedValue(new AuthorizationError("Forbidden"));

    expect((await get()).status).toBe(403);
    expect(mocks.getOrganization).not.toHaveBeenCalled();
  });

  test("answers 403 for a workspace that does not exist, the same as for one the caller can't see", async () => {
    mocks.resolveWorkspace.mockRejectedValue(new ResourceNotFoundError("Workspace", WORKSPACE_ID));

    expect((await get()).status).toBe(403);
  });

  test("answers 403 for an organization that is gone", async () => {
    mocks.getOrganization.mockResolvedValue(null);

    expect((await get()).status).toBe(403);
  });

  test("audits nothing: it is a read", async () => {
    await get();
    expect(mocks.queueAuditEvent).not.toHaveBeenCalled();
  });

  test("answers 400 for a malformed workspace id, and 401 without a session", async () => {
    expect((await get("not-a-cuid")).status).toBe(400);
    mocks.getSession.mockResolvedValue(null);
    expect((await get()).status).toBe(401);
  });
});
