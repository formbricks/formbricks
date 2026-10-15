import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { SAME_ORIGIN_HEADERS } from "@/app/api/v3/lib/test-utils";
import { DELETE, PATCH } from "./route";

const mocks = vi.hoisted(() => ({
  can: vi.fn(),
  getSession: vi.fn(),
  getOrganization: vi.fn(),
  updateOrganization: vi.fn(),
  deleteOrganization: vi.fn(),
  isInstanceAIConfigured: vi.fn(),
  getIsMultiOrgEnabled: vi.fn(),
  queueAuditEvent: vi.fn(),
}));

vi.mock("@/lib/authorization", () => ({ can: mocks.can }));
vi.mock("@/lib/organization/service", () => ({
  getOrganization: mocks.getOrganization,
  updateOrganization: mocks.updateOrganization,
  deleteOrganization: mocks.deleteOrganization,
}));
vi.mock("@/lib/ai/service", () => ({ isInstanceAIConfigured: mocks.isInstanceAIConfigured }));
vi.mock("@/modules/ee/license-check/lib/utils", () => ({ getIsMultiOrgEnabled: mocks.getIsMultiOrgEnabled }));
vi.mock("@/modules/auth/lib/session", () => ({ getSession: mocks.getSession }));
vi.mock("@/app/api/v1/auth", () => ({ authenticateRequest: vi.fn() }));
vi.mock("@/modules/core/rate-limit/helpers", () => ({
  applyRateLimit: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/modules/ee/audit-logs/lib/handler", () => ({ queueAuditEvent: mocks.queueAuditEvent }));
vi.mock("@/app/lib/api/with-api-logging", () => ({
  buildAuditLogBaseObject: vi.fn((action: string, targetType: string) => ({
    action,
    targetType,
    status: "failure",
  })),
}));
vi.mock("@formbricks/logger", () => ({
  logger: { withContext: vi.fn(() => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn() })), error: vi.fn() },
}));
vi.mock("server-only", () => ({}));

const ORG_ID = "clorg11111111111111111111";
const USER_ID = "cluser1111111111111111111";

const organization = (overrides: Record<string, unknown> = {}) => ({
  id: ORG_ID,
  createdAt: new Date("2026-10-01T10:00:00.000Z"),
  updatedAt: new Date("2026-10-01T10:00:00.000Z"),
  name: "Acme",
  billing: { stripeCustomerId: "cus_secret" },
  whitelabel: {},
  isAISmartToolsEnabled: false,
  displayTimeZone: null,
  ...overrides,
});

const url = (id = ORG_ID) => `http://localhost/api/internal/organizations/${id}`;
const props = (id = ORG_ID) => ({ params: Promise.resolve({ organizationId: id }) });

const patch = (
  body: unknown,
  { id = ORG_ID, headers = SAME_ORIGIN_HEADERS as Record<string, string> } = {}
) =>
  PATCH(
    new NextRequest(url(id), {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
    }),
    props(id) as never
  );

const remove = ({ id = ORG_ID, headers = SAME_ORIGIN_HEADERS as Record<string, string> } = {}) =>
  DELETE(new NextRequest(url(id), { method: "DELETE", headers }), props(id) as never);

/** Grant exactly these organization actions. */
const allow = (...actions: string[]) =>
  mocks.can.mockImplementation(async (_actor: unknown, action: string) => actions.includes(action));

const checkedActions = () => mocks.can.mock.calls.map(([, action]) => action);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getSession.mockResolvedValue({ user: { id: USER_ID } });
  allow("organization.write", "organization.manage");
  mocks.getOrganization.mockResolvedValue(organization());
  mocks.updateOrganization.mockImplementation(async (_id: string, data: Record<string, unknown>) =>
    organization(data)
  );
  mocks.deleteOrganization.mockResolvedValue(organization());
  mocks.isInstanceAIConfigured.mockReturnValue(true);
  mocks.getIsMultiOrgEnabled.mockResolvedValue(true);
});

describe("PATCH /api/internal/organizations/{organizationId}", () => {
  test("lets an owner rename the organization, and returns its settings without billing", async () => {
    const response = await patch({ name: "  Acme Inc.  " });

    expect(response.status).toBe(200);
    expect((await response.json()).data).toEqual({
      id: ORG_ID,
      name: "Acme Inc.",
      isAISmartToolsEnabled: false,
      displayTimeZone: null,
    });
    expect(checkedActions()).toEqual(["organization.write"]);
    expect(mocks.updateOrganization).toHaveBeenCalledWith(ORG_ID, { name: "Acme Inc." });
    expect(mocks.queueAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "updated",
        targetType: "organization",
        status: "success",
        organizationId: ORG_ID,
        targetId: ORG_ID,
        oldObject: expect.objectContaining({ name: "Acme" }),
        newObject: expect.objectContaining({ name: "Acme Inc." }),
      })
    );
  });

  test("lets a manager set the display time zone, which only needs organization.manage", async () => {
    allow("organization.manage");
    const response = await patch({ displayTimeZone: "Europe/Lisbon" });

    expect(response.status).toBe(200);
    expect((await response.json()).data.displayTimeZone).toBe("Europe/Lisbon");
    expect(checkedActions()).toEqual(["organization.manage"]);
  });

  test("resets the display time zone to the UTC default with null", async () => {
    mocks.getOrganization.mockResolvedValue(organization({ displayTimeZone: "Europe/Lisbon" }));
    const response = await patch({ displayTimeZone: null });

    expect(response.status).toBe(200);
    expect(mocks.updateOrganization).toHaveBeenCalledWith(ORG_ID, { displayTimeZone: null });
  });

  test("refuses a manager's rename with 403, and changes nothing", async () => {
    allow("organization.manage");
    const response = await patch({ name: "Taken over", displayTimeZone: "Europe/Lisbon" });

    expect(response.status).toBe(403);
    expect(mocks.updateOrganization).not.toHaveBeenCalled();
    expect(mocks.getOrganization).not.toHaveBeenCalled();
  });

  test("refuses a member with 403, and audits the refusal against the organization", async () => {
    allow();
    expect((await patch({ displayTimeZone: "Europe/Lisbon" })).status).toBe(403);
    expect(mocks.updateOrganization).not.toHaveBeenCalled();
    expect(mocks.queueAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ status: "failure", organizationId: ORG_ID, targetId: ORG_ID })
    );
  });

  test("answers 403 for an organization that is gone, the same as for one the caller can't see", async () => {
    mocks.getOrganization.mockResolvedValue(null);
    expect((await patch({ name: "Acme" })).status).toBe(403);
    expect(mocks.updateOrganization).not.toHaveBeenCalled();
  });

  test("refuses to turn AI on when the instance has no AI provider configured", async () => {
    mocks.isInstanceAIConfigured.mockReturnValue(false);
    const response = await patch({ isAISmartToolsEnabled: true });

    expect(response.status).toBe(503);
    expect((await response.json()).code).toBe("ai_instance_not_configured");
    expect(mocks.updateOrganization).not.toHaveBeenCalled();
  });

  test.each([
    ["turning AI off", false, false],
    ["re-sending AI on when it is already on", true, true],
  ])("allows %s while the instance has no AI provider", async (_label, current, requested) => {
    mocks.isInstanceAIConfigured.mockReturnValue(false);
    mocks.getOrganization.mockResolvedValue(organization({ isAISmartToolsEnabled: current }));

    expect((await patch({ isAISmartToolsEnabled: requested })).status).toBe(200);
    expect(mocks.updateOrganization).toHaveBeenCalledWith(ORG_ID, { isAISmartToolsEnabled: requested });
  });

  test("turns AI on when the instance is configured", async () => {
    const response = await patch({ isAISmartToolsEnabled: true });

    expect(response.status).toBe(200);
    expect((await response.json()).data.isAISmartToolsEnabled).toBe(true);
    expect(checkedActions()).toEqual(["organization.manage"]);
  });

  test.each([
    ["no field", {}],
    ["a blank name", { name: "   " }],
    ["an unknown time zone", { displayTimeZone: "Mars/Olympus_Mons" }],
    ["billing, which this route never writes", { billing: { plan: "enterprise" } }],
    ["whitelabel, which this route never writes", { whitelabel: { logoUrl: "https://evil.test/x.png" } }],
  ])("answers 400 for %s", async (_label, body) => {
    expect((await patch(body)).status).toBe(400);
    expect(mocks.updateOrganization).not.toHaveBeenCalled();
  });

  test("answers 400 for a malformed organization id", async () => {
    expect((await patch({ name: "x" }, { id: "not a cuid" })).status).toBe(400);
  });

  test("answers 401 without a session", async () => {
    mocks.getSession.mockResolvedValue(null);
    expect((await patch({ name: "x" })).status).toBe(401);
    expect(mocks.updateOrganization).not.toHaveBeenCalled();
  });

  test("refuses a cross-site request (CSRF)", async () => {
    expect((await patch({ name: "x" }, { headers: { "sec-fetch-site": "cross-site" } })).status).toBe(403);
    expect(mocks.updateOrganization).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/internal/organizations/{organizationId}", () => {
  test("lets an owner delete the organization with a 204, and audits what was removed", async () => {
    const response = await remove();

    expect(response.status).toBe(204);
    expect(checkedActions()).toEqual(["organization.write"]);
    expect(mocks.deleteOrganization).toHaveBeenCalledWith(ORG_ID);
    expect(mocks.queueAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "deleted",
        targetType: "organization",
        status: "success",
        organizationId: ORG_ID,
        targetId: ORG_ID,
        oldObject: expect.objectContaining({ name: "Acme" }),
      })
    );
  });

  test("refuses a manager with 403, deletes nothing, and audits the refusal against the organization", async () => {
    allow("organization.manage");
    expect((await remove()).status).toBe(403);
    expect(mocks.deleteOrganization).not.toHaveBeenCalled();
    expect(mocks.queueAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "deleted",
        status: "failure",
        organizationId: ORG_ID,
        targetId: ORG_ID,
      })
    );
  });

  test("refuses when the licence allows only one organization, after authorizing the caller", async () => {
    mocks.getIsMultiOrgEnabled.mockResolvedValue(false);
    const response = await remove();

    expect(response.status).toBe(403);
    expect((await response.json()).detail).toBe("Organization deletion is disabled.");
    expect(mocks.deleteOrganization).not.toHaveBeenCalled();
  });

  test("checks no licence for a caller who may not delete it anyway", async () => {
    allow();
    expect((await remove()).status).toBe(403);
    expect(mocks.getIsMultiOrgEnabled).not.toHaveBeenCalled();
  });

  test("refuses a request with neither Sec-Fetch-Site nor Origin (CSRF, fail-safe)", async () => {
    expect((await remove({ headers: {} })).status).toBe(403);
    expect(mocks.deleteOrganization).not.toHaveBeenCalled();
  });
});
