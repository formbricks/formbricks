import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { GET } from "./route";

const mocks = vi.hoisted(() => ({
  can: vi.fn(),
  getSession: vi.fn(),
  getOrganization: vi.fn(),
  queueAuditEvent: vi.fn(),
}));

vi.mock("@/lib/authorization", () => ({ can: mocks.can }));
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
const USER_ID = "cluser1111111111111111111";

const organization = (limits: Record<string, unknown>) => ({
  id: ORG_ID,
  name: "Acme",
  billing: {
    stripeCustomerId: "cus_secret",
    usageCycleAnchor: null,
    limits,
    stripe: { plan: "pro", subscriptionId: "sub_secret", hasPaymentMethod: true },
  },
});

const get = (id = ORG_ID) =>
  GET(new NextRequest(`http://localhost/api/internal/organizations/${id}/billing`), {
    params: Promise.resolve({ organizationId: id }),
  } as never);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getSession.mockResolvedValue({ user: { id: USER_ID } });
  mocks.can.mockResolvedValue(true);
  mocks.getOrganization.mockResolvedValue(
    organization({ workspaces: 3, monthly: { responses: 1500, workflowRuns: 100 } })
  );
});

describe("GET /api/internal/organizations/{organizationId}/billing", () => {
  test("returns the plan limits to a caller who may manage billing, and nothing of Stripe", async () => {
    const response = await get();

    expect(response.status).toBe(200);
    expect((await response.json()).data).toEqual({
      limits: { workspaces: 3, monthly: { responses: 1500, workflowRuns: 100 } },
    });
    expect(mocks.can).toHaveBeenCalledWith({ type: "user", id: USER_ID }, "organization.manage_billing", {
      type: "organization",
      id: ORG_ID,
    });
    expect(mocks.can).toHaveBeenCalledTimes(1);
  });

  test("returns unlimited plans as null, and an unmetered workflow budget as null", async () => {
    mocks.getOrganization.mockResolvedValue(organization({ workspaces: null, monthly: { responses: null } }));

    expect((await (await get()).json()).data).toEqual({
      limits: { workspaces: null, monthly: { responses: null, workflowRuns: null } },
    });
  });

  test("refuses a caller who may not manage billing with 403, and reads nothing", async () => {
    mocks.can.mockResolvedValue(false);

    expect((await get()).status).toBe(403);
    expect(mocks.getOrganization).not.toHaveBeenCalled();
  });

  test("answers 403 for an organization that is gone, the same as for one the caller can't see", async () => {
    mocks.getOrganization.mockResolvedValue(null);
    expect((await get()).status).toBe(403);
  });

  test("audits nothing: it is a read, as before", async () => {
    await get();
    mocks.can.mockResolvedValue(false);
    await get();
    expect(mocks.queueAuditEvent).not.toHaveBeenCalled();
  });

  test("answers 400 for a malformed organization id", async () => {
    expect((await get("not a cuid")).status).toBe(400);
  });

  test("answers 401 without a session", async () => {
    mocks.getSession.mockResolvedValue(null);
    expect((await get()).status).toBe(401);
    expect(mocks.getOrganization).not.toHaveBeenCalled();
  });
});
