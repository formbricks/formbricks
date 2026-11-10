import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { TooManyRequestsError } from "@formbricks/types/errors";
import { SAME_ORIGIN_HEADERS } from "@/app/api/v3/lib/test-utils";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import { WHITELABEL_IMAGE_URL_MAX_LENGTH } from "../lib/limits";
import { DELETE, PUT } from "./route";

const mocks = vi.hoisted(() => ({
  can: vi.fn(),
  getSession: vi.fn(),
  applyRateLimit: vi.fn(),
  queueAuditEvent: vi.fn(),
  getOrganization: vi.fn(),
  getWhiteLabelPermission: vi.fn(),
  updateOrganizationFaviconUrl: vi.fn(),
}));

vi.mock("@/lib/authorization", () => ({ can: mocks.can }));
vi.mock("@/lib/organization/service", () => ({ getOrganization: mocks.getOrganization }));
vi.mock("@/modules/ee/license-check/lib/utils", () => ({
  getWhiteLabelPermission: mocks.getWhiteLabelPermission,
}));
vi.mock("@/modules/ee/whitelabel/favicon-customization/lib/organization", () => ({
  updateOrganizationFaviconUrl: mocks.updateOrganizationFaviconUrl,
}));
vi.mock("@/modules/auth/lib/session", () => ({ getSession: mocks.getSession }));
vi.mock("@/app/api/v1/auth", () => ({ authenticateRequest: vi.fn() }));
vi.mock("@/modules/core/rate-limit/helpers", () => ({ applyRateLimit: mocks.applyRateLimit }));
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
const FAVICON_URL = "/storage/clwork1111111111111111111/public/favicon.png";

const url = (id = ORG_ID) => `http://localhost/api/internal/organizations/${id}/favicon`;
const props = (id = ORG_ID) => ({ params: Promise.resolve({ organizationId: id }) });

const put = (body: unknown, { id = ORG_ID, headers = SAME_ORIGIN_HEADERS as Record<string, string> } = {}) =>
  PUT(
    new NextRequest(url(id), {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
    }),
    props(id) as never
  );

const remove = ({ id = ORG_ID, headers = SAME_ORIGIN_HEADERS as Record<string, string> } = {}) =>
  DELETE(new NextRequest(url(id), { method: "DELETE", headers }), props(id) as never);

const checkedActions = () => mocks.can.mock.calls.map(([, action, resource]) => [action, resource]);

/** The rate limits charged, by namespace and identifier, after the wrapper's own per-user one. */
const operationLimits = () =>
  mocks.applyRateLimit.mock.calls
    .filter(([config]) => config.namespace !== rateLimitConfigs.api.v3.namespace)
    .map(([config, identifier]) => [config.namespace, identifier]);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getSession.mockResolvedValue({ user: { id: USER_ID } });
  mocks.can.mockResolvedValue(true);
  mocks.applyRateLimit.mockResolvedValue(undefined);
  mocks.getOrganization.mockResolvedValue({ id: ORG_ID, whitelabel: {} });
  mocks.getWhiteLabelPermission.mockResolvedValue(true);
  mocks.updateOrganizationFaviconUrl.mockResolvedValue(true);
});

describe("PUT /api/internal/organizations/{organizationId}/favicon", () => {
  test("accepts an absolute https URL", async () => {
    expect((await put({ faviconUrl: "https://cdn.example.com/favicon.png" })).status).toBe(200);
  });

  test("lets a manager set the favicon, charged to the organization, and audits the new URL", async () => {
    const response = await put({ faviconUrl: FAVICON_URL });

    expect(response.status).toBe(200);
    expect((await response.json()).data).toEqual({ organizationId: ORG_ID, faviconUrl: FAVICON_URL });
    expect(checkedActions()).toEqual([["organization.manage", { type: "organization", id: ORG_ID }]]);
    expect(operationLimits()).toEqual([[rateLimitConfigs.actions.stateMutation.namespace, ORG_ID]]);
    expect(mocks.getWhiteLabelPermission).toHaveBeenCalledWith(ORG_ID);
    expect(mocks.updateOrganizationFaviconUrl).toHaveBeenCalledWith(ORG_ID, FAVICON_URL);
    expect(mocks.queueAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "updated",
        targetType: "organization",
        status: "success",
        organizationId: ORG_ID,
        targetId: ORG_ID,
        newObject: { faviconUrl: FAVICON_URL },
      })
    );
  });

  test("refuses a caller who can't manage the organization with 403, before any budget or licence", async () => {
    mocks.can.mockResolvedValue(false);

    const response = await put({ faviconUrl: FAVICON_URL });

    expect(response.status).toBe(403);
    expect(operationLimits()).toEqual([]);
    expect(mocks.getWhiteLabelPermission).not.toHaveBeenCalled();
    expect(mocks.updateOrganizationFaviconUrl).not.toHaveBeenCalled();
    expect(mocks.queueAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ status: "failure", organizationId: ORG_ID, targetId: ORG_ID })
    );
  });

  test("refuses without the whitelabel licence, with its reason", async () => {
    mocks.getWhiteLabelPermission.mockResolvedValue(false);

    const response = await put({ faviconUrl: FAVICON_URL });

    expect(response.status).toBe(403);
    expect((await response.json()).detail).toBe("White label is not allowed for this organization");
    expect(mocks.updateOrganizationFaviconUrl).not.toHaveBeenCalled();
  });

  test("answers the uniform 403 for an organization that is gone", async () => {
    mocks.getOrganization.mockResolvedValue(null);

    const response = await put({ faviconUrl: FAVICON_URL });

    expect(response.status).toBe(403);
    expect((await response.json()).detail).toBe("You are not authorized to access this resource");
    expect(mocks.updateOrganizationFaviconUrl).not.toHaveBeenCalled();
  });

  test("answers 429 once the organization's settings-write budget is spent, and changes nothing", async () => {
    mocks.applyRateLimit.mockImplementation(async (config: { namespace: string }) => {
      if (config.namespace === rateLimitConfigs.actions.stateMutation.namespace) {
        throw new TooManyRequestsError("Maximum number of requests reached. Please try again later.", 60);
      }
    });

    const response = await put({ faviconUrl: FAVICON_URL });

    expect(response.status).toBe(429);
    expect(mocks.getWhiteLabelPermission).not.toHaveBeenCalled();
    expect(mocks.updateOrganizationFaviconUrl).not.toHaveBeenCalled();
  });

  test.each([
    ["no logo URL", {}],
    ["a non-string logo URL", { faviconUrl: 42 }],
    ["an unknown key", { faviconUrl: FAVICON_URL, logoUrl: FAVICON_URL }],
    ["a script URL", { faviconUrl: "javascript:alert(1)" }],
    ["a relative path outside storage", { faviconUrl: "/favicon.png" }],
    ["a logo URL past the cap", { faviconUrl: `/storage/${"a".repeat(WHITELABEL_IMAGE_URL_MAX_LENGTH)}` }],
  ])("answers 400 for %s", async (_label, body) => {
    expect((await put(body)).status).toBe(400);
    expect(mocks.updateOrganizationFaviconUrl).not.toHaveBeenCalled();
  });

  test("answers 400 for a malformed organization id", async () => {
    expect((await put({ faviconUrl: FAVICON_URL }, { id: "not a cuid" })).status).toBe(400);
  });

  test("answers 401 without a session", async () => {
    mocks.getSession.mockResolvedValue(null);
    expect((await put({ faviconUrl: FAVICON_URL })).status).toBe(401);
    expect(mocks.updateOrganizationFaviconUrl).not.toHaveBeenCalled();
  });

  test("refuses a cross-site request (CSRF)", async () => {
    const response = await put({ faviconUrl: FAVICON_URL }, { headers: { "sec-fetch-site": "cross-site" } });
    expect(response.status).toBe(403);
    expect(mocks.updateOrganizationFaviconUrl).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/internal/organizations/{organizationId}/favicon", () => {
  test("removes the favicon with the same checks, and audits it as updated", async () => {
    const response = await remove();

    expect(response.status).toBe(204);
    expect(checkedActions()).toEqual([["organization.manage", { type: "organization", id: ORG_ID }]]);
    expect(operationLimits()).toEqual([[rateLimitConfigs.actions.stateMutation.namespace, ORG_ID]]);
    expect(mocks.getWhiteLabelPermission).toHaveBeenCalledWith(ORG_ID);
    expect(mocks.updateOrganizationFaviconUrl).toHaveBeenCalledWith(ORG_ID, null);
    expect(mocks.queueAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "updated",
        targetType: "organization",
        status: "success",
        organizationId: ORG_ID,
        targetId: ORG_ID,
        oldObject: { faviconUrl: "" },
      })
    );
  });

  test("refuses without the whitelabel licence", async () => {
    mocks.getWhiteLabelPermission.mockResolvedValue(false);
    expect((await remove()).status).toBe(403);
    expect(mocks.updateOrganizationFaviconUrl).not.toHaveBeenCalled();
  });

  test("refuses a caller who can't manage the organization", async () => {
    mocks.can.mockResolvedValue(false);
    expect((await remove()).status).toBe(403);
    expect(mocks.updateOrganizationFaviconUrl).not.toHaveBeenCalled();
  });

  test("refuses a cross-site request (CSRF)", async () => {
    expect((await remove({ headers: { "sec-fetch-site": "cross-site" } })).status).toBe(403);
    expect(mocks.updateOrganizationFaviconUrl).not.toHaveBeenCalled();
  });
});
