import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { TooManyRequestsError } from "@formbricks/types/errors";
import { SAME_ORIGIN_HEADERS } from "@/app/api/v3/lib/test-utils";
import { DEFAULT_WORKSPACE_NAME } from "@/lib/workspace/constants";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import { POST } from "./route";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  getUser: vi.fn(),
  applyRateLimit: vi.fn(),
  getHasNoOrganizations: vi.fn(),
  getIsMultiOrgEnabled: vi.fn(),
  createOrganization: vi.fn(),
  createMembership: vi.fn(),
  createWorkspace: vi.fn(),
  capturePostHogEvent: vi.fn(),
  queueAuditEvent: vi.fn(),
}));

vi.mock("@/modules/auth/lib/session", () => ({ getSession: mocks.getSession }));
vi.mock("@/app/api/v1/auth", () => ({ authenticateRequest: vi.fn() }));
vi.mock("@/lib/user/service", () => ({ getUser: mocks.getUser }));
vi.mock("@/modules/core/rate-limit/helpers", () => ({
  applyRateLimit: mocks.applyRateLimit,
  applyIPRateLimit: vi.fn(),
}));
vi.mock("@/lib/instance/service", () => ({ getHasNoOrganizations: mocks.getHasNoOrganizations }));
vi.mock("@/modules/ee/license-check/lib/utils", () => ({ getIsMultiOrgEnabled: mocks.getIsMultiOrgEnabled }));
vi.mock("@/lib/organization/service", () => ({
  createOrganization: mocks.createOrganization,
  getOrganization: vi.fn(),
  updateOrganization: vi.fn(),
  deleteOrganization: vi.fn(),
}));
vi.mock("@/lib/membership/service", () => ({ createMembership: mocks.createMembership }));
vi.mock("@/modules/workspaces/settings/lib/workspace", () => ({ createWorkspace: mocks.createWorkspace }));
vi.mock("@/modules/ee/billing/lib/organization-billing", () => ({
  ensureCloudStripeSetupForOrganization: vi.fn(),
}));
vi.mock("@/lib/posthog", () => ({
  capturePostHogEvent: mocks.capturePostHogEvent,
  getEmailDomain: vi.fn(() => "example.com"),
  groupIdentifyPostHog: vi.fn(),
}));
vi.mock("@/lib/ai/service", () => ({ isInstanceAIConfigured: vi.fn() }));
vi.mock("@/lib/authorization", () => ({ can: vi.fn() }));
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

const USER_ID = "cluser1111111111111111111";
const ORG_ID = "clorg11111111111111111111";
const organization = { id: ORG_ID, name: "Acme", billing: { stripeCustomerId: "cus_secret" } };

const create = (
  body: unknown = { name: "  Acme  " },
  headers: Record<string, string> = SAME_ORIGIN_HEADERS
) =>
  POST(
    new NextRequest("http://localhost/api/internal/organizations", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
    }),
    {} as never
  );

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getSession.mockResolvedValue({ user: { id: USER_ID } });
  mocks.getUser.mockResolvedValue({ id: USER_ID, email: "ada@example.com" });
  mocks.applyRateLimit.mockResolvedValue(undefined);
  mocks.getHasNoOrganizations.mockResolvedValue(true);
  mocks.getIsMultiOrgEnabled.mockResolvedValue(false);
  mocks.createOrganization.mockResolvedValue(organization);
  mocks.createWorkspace.mockResolvedValue({ id: "clws111111111111111111111", name: "My Workspace" });
});

describe("POST /api/internal/organizations", () => {
  test("creates the organization with its owner and first workspace, and answers its id and name only", async () => {
    const response = await create();

    expect(response.status).toBe(201);
    expect(response.headers.get("Location")).toBe(`/api/internal/organizations/${ORG_ID}`);
    expect((await response.json()).data).toEqual({ id: ORG_ID, name: "Acme" });
    expect(mocks.createOrganization).toHaveBeenCalledWith({ name: "Acme" });
    expect(mocks.createMembership).toHaveBeenCalledWith(ORG_ID, USER_ID, { role: "owner", accepted: true });
    expect(mocks.createWorkspace).toHaveBeenCalledWith(
      ORG_ID,
      { name: DEFAULT_WORKSPACE_NAME },
      { workspaceLimit: null }
    );
    expect(mocks.queueAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "created",
        targetType: "organization",
        status: "success",
        organizationId: ORG_ID,
        targetId: ORG_ID,
      })
    );
  });

  test("counts the creation against the requesting user's daily budget, and creates nothing past it", async () => {
    mocks.applyRateLimit.mockImplementation(async (config: { namespace: string }) => {
      if (config.namespace === rateLimitConfigs.actions.createOrganization.namespace)
        throw new TooManyRequestsError("Maximum number of requests reached.", 3600);
    });

    const response = await create();

    expect(mocks.applyRateLimit).toHaveBeenCalledWith(rateLimitConfigs.actions.createOrganization, USER_ID);
    expect(response.status).toBe(429);
    expect(mocks.createOrganization).not.toHaveBeenCalled();
    expect(mocks.createMembership).not.toHaveBeenCalled();
    expect(mocks.createWorkspace).not.toHaveBeenCalled();
  });

  test("refuses a second organization unless the licence allows several", async () => {
    mocks.getHasNoOrganizations.mockResolvedValue(false);

    const refused = await create();
    expect(refused.status).toBe(403);
    expect((await refused.json()).detail).toBe("This action can only be performed on a fresh instance.");
    expect(mocks.createOrganization).not.toHaveBeenCalled();

    mocks.getIsMultiOrgEnabled.mockResolvedValue(true);
    expect((await create()).status).toBe(201);
  });

  test.each([
    ["a blank name", { name: "   " }],
    ["an unknown field", { name: "Acme", billing: {} }],
  ])("answers 400 for %s", async (_label, body) => {
    expect((await create(body)).status).toBe(400);
    expect(mocks.createOrganization).not.toHaveBeenCalled();
  });

  test("answers 401 without a session, and refuses a cross-site request", async () => {
    expect((await create(undefined, { "sec-fetch-site": "cross-site" })).status).toBe(403);
    mocks.getSession.mockResolvedValue(null);
    expect((await create()).status).toBe(401);
    expect(mocks.createOrganization).not.toHaveBeenCalled();
  });
});
