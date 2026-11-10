import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { InvalidInputError, TooManyRequestsError } from "@formbricks/types/errors";
import { SAME_ORIGIN_HEADERS } from "@/app/api/v3/lib/test-utils";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import { POST } from "./route";

const mocks = vi.hoisted(() => ({
  can: vi.fn(),
  getSession: vi.fn(),
  applyRateLimit: vi.fn(),
  queueAuditEvent: vi.fn(),
  getOrganization: vi.fn(),
  getUser: vi.fn(),
  getWhiteLabelPermission: vi.fn(),
  sendEmailCustomizationPreviewEmail: vi.fn(),
}));

vi.mock("@/lib/authorization", () => ({ can: mocks.can }));
vi.mock("@/lib/organization/service", () => ({ getOrganization: mocks.getOrganization }));
vi.mock("@/lib/user/service", () => ({ getUser: mocks.getUser }));
vi.mock("@/modules/ee/license-check/lib/utils", () => ({
  getWhiteLabelPermission: mocks.getWhiteLabelPermission,
}));
vi.mock("@/modules/email", () => ({
  sendEmailCustomizationPreviewEmail: mocks.sendEmailCustomizationPreviewEmail,
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
const LOGO_URL = "/storage/clwork1111111111111111111/public/logo.png";

const send = ({ id = ORG_ID, headers = SAME_ORIGIN_HEADERS as Record<string, string> } = {}) =>
  POST(
    new NextRequest(`http://localhost/api/internal/organizations/${id}/test-emails`, {
      method: "POST",
      headers,
    }),
    { params: Promise.resolve({ organizationId: id }) } as never
  );

const operationLimits = () =>
  mocks.applyRateLimit.mock.calls
    .filter(([config]) => config.namespace !== rateLimitConfigs.api.v3.namespace)
    .map(([config, identifier]) => [config.namespace, identifier]);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getSession.mockResolvedValue({ user: { id: USER_ID } });
  mocks.can.mockResolvedValue(true);
  mocks.applyRateLimit.mockResolvedValue(undefined);
  mocks.getOrganization.mockResolvedValue({ id: ORG_ID, whitelabel: { logoUrl: LOGO_URL } });
  mocks.getUser.mockResolvedValue({ id: USER_ID, email: "ada@example.com", name: "Ada", locale: "de-DE" });
  mocks.getWhiteLabelPermission.mockResolvedValue(true);
  mocks.sendEmailCustomizationPreviewEmail.mockResolvedValue(true);
});

describe("POST /api/internal/organizations/{organizationId}/test-emails", () => {
  test("emails the caller a preview with the saved logo, and answers 202", async () => {
    const response = await send();

    expect(response.status).toBe(202);
    expect((await response.json()).data).toEqual({ emailSent: true });
    expect(mocks.can).toHaveBeenCalledWith({ type: "user", id: USER_ID }, "organization.manage", {
      type: "organization",
      id: ORG_ID,
    });
    expect(mocks.getWhiteLabelPermission).toHaveBeenCalledWith(ORG_ID);
    expect(mocks.sendEmailCustomizationPreviewEmail).toHaveBeenCalledWith(
      "ada@example.com",
      "Ada",
      "de-DE",
      USER_ID,
      LOGO_URL,
      ORG_ID
    );
    // No settings-write budget, as before; the email service limits the sender. Nothing is audited.
    expect(operationLimits()).toEqual([]);
    expect(mocks.queueAuditEvent).not.toHaveBeenCalled();
  });

  test("sends the preview with no logo when none is saved", async () => {
    mocks.getOrganization.mockResolvedValue({ id: ORG_ID, whitelabel: null });
    expect((await send()).status).toBe(202);
    expect(mocks.sendEmailCustomizationPreviewEmail).toHaveBeenCalledWith(
      "ada@example.com",
      "Ada",
      "de-DE",
      USER_ID,
      "",
      ORG_ID
    );
  });

  test("answers 202 without SMTP, as the page reported it before", async () => {
    mocks.sendEmailCustomizationPreviewEmail.mockResolvedValue(false);
    const response = await send();
    expect(response.status).toBe(202);
    expect((await response.json()).data).toEqual({ emailSent: false });
  });

  test("refuses a caller who can't manage the organization", async () => {
    mocks.can.mockResolvedValue(false);
    expect((await send()).status).toBe(403);
    expect(mocks.sendEmailCustomizationPreviewEmail).not.toHaveBeenCalled();
  });

  test("refuses without the whitelabel licence, with its reason", async () => {
    mocks.getWhiteLabelPermission.mockResolvedValue(false);
    const response = await send();
    expect(response.status).toBe(403);
    expect((await response.json()).detail).toBe("White label is not allowed for this organization");
    expect(mocks.sendEmailCustomizationPreviewEmail).not.toHaveBeenCalled();
  });

  test("answers the uniform 403 for an organization that is gone", async () => {
    mocks.getOrganization.mockResolvedValue(null);
    const response = await send();
    expect(response.status).toBe(403);
    expect((await response.json()).detail).toBe("You are not authorized to access this resource");
    expect(mocks.sendEmailCustomizationPreviewEmail).not.toHaveBeenCalled();
  });

  test("answers 429 with the email limiter's message once the sender's budget is spent", async () => {
    mocks.sendEmailCustomizationPreviewEmail.mockRejectedValue(
      new TooManyRequestsError("Maximum number of requests reached. Please try again later.", 60)
    );
    const response = await send();
    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("60");
    expect((await response.json()).detail).toBe(
      "Maximum number of requests reached. Please try again later."
    );
  });

  test("answers 502 with the SMTP failure the page shows", async () => {
    mocks.sendEmailCustomizationPreviewEmail.mockRejectedValue(
      new InvalidInputError("Incorrect SMTP credentials")
    );
    const response = await send();
    expect(response.status).toBe(502);
    expect((await response.json()).detail).toBe("Incorrect SMTP credentials");
  });

  test("answers 401 without a session", async () => {
    mocks.getSession.mockResolvedValue(null);
    expect((await send()).status).toBe(401);
    expect(mocks.sendEmailCustomizationPreviewEmail).not.toHaveBeenCalled();
  });

  test("refuses a cross-site request (CSRF)", async () => {
    expect((await send({ headers: { "sec-fetch-site": "cross-site" } })).status).toBe(403);
    expect(mocks.sendEmailCustomizationPreviewEmail).not.toHaveBeenCalled();
  });
});
