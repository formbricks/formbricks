import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { AuthorizationError, ResourceNotFoundError, TooManyRequestsError } from "@formbricks/types/errors";
import { SAME_ORIGIN_HEADERS } from "@/app/api/v3/lib/test-utils";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import { PATCH } from "./route";

const mocks = vi.hoisted(() => ({
  assertCan: vi.fn(),
  getSession: vi.fn(),
  resolveWorkspace: vi.fn(),
  applyRateLimit: vi.fn(),
  queueAuditEvent: vi.fn(),
  capturePostHogEvent: vi.fn(),
  getOrganization: vi.fn(),
  getRemoveBrandingPermission: vi.fn(),
  updateWorkspaceBranding: vi.fn(),
  getWorkspace: vi.fn(),
}));

vi.mock("@/lib/authorization", () => ({ assertCan: mocks.assertCan, can: vi.fn() }));
vi.mock("@/app/api/v3/lib/workspace-context", () => ({ resolveV3WorkspaceContext: mocks.resolveWorkspace }));
vi.mock("@/lib/organization/service", () => ({ getOrganization: mocks.getOrganization }));
vi.mock("@/modules/ee/license-check/lib/utils", () => ({
  getRemoveBrandingPermission: mocks.getRemoveBrandingPermission,
}));
vi.mock("@/modules/ee/whitelabel/remove-branding/lib/workspace", () => ({
  updateWorkspaceBranding: mocks.updateWorkspaceBranding,
}));
vi.mock("@/modules/survey/editor/lib/workspace", () => ({ getWorkspace: mocks.getWorkspace }));
vi.mock("@/lib/posthog", () => ({ capturePostHogEvent: mocks.capturePostHogEvent }));
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

const USER_ID = "cluser1111111111111111111";
const ORG_ID = "clorg11111111111111111111";
const WORKSPACE_ID = "clwork1111111111111111111";

const workspace = (overrides: Record<string, unknown> = {}) => ({
  id: WORKSPACE_ID,
  organizationId: ORG_ID,
  name: "Website",
  linkSurveyBranding: true,
  inAppSurveyBranding: true,
  ...overrides,
});

const patch = (
  body: unknown,
  { id = WORKSPACE_ID, headers = SAME_ORIGIN_HEADERS as Record<string, string> } = {}
) =>
  PATCH(
    new NextRequest(`http://localhost/api/internal/workspaces/${id}/branding`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ workspaceId: id }) } as never
  );

const checkedActions = () => mocks.assertCan.mock.calls.map(([, action, resource]) => [action, resource]);

/** The rate limits charged, by namespace and identifier, after the wrapper's own per-user one. */
const operationLimits = () =>
  mocks.applyRateLimit.mock.calls
    .filter(([config]) => config.namespace !== rateLimitConfigs.api.v3.namespace)
    .map(([config, identifier]) => [config.namespace, identifier]);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getSession.mockResolvedValue({ user: { id: USER_ID } });
  mocks.assertCan.mockResolvedValue(undefined);
  mocks.resolveWorkspace.mockResolvedValue({ workspaceId: WORKSPACE_ID, organizationId: ORG_ID });
  mocks.applyRateLimit.mockResolvedValue(undefined);
  mocks.getOrganization.mockResolvedValue({ id: ORG_ID });
  mocks.getRemoveBrandingPermission.mockResolvedValue(true);
  mocks.updateWorkspaceBranding.mockResolvedValue(true);
  mocks.getWorkspace
    .mockResolvedValueOnce(workspace())
    .mockResolvedValueOnce(workspace({ linkSurveyBranding: false }));
});

describe("PATCH /api/internal/workspaces/{workspaceId}/branding", () => {
  test("lets a workspace manager hide link survey branding, and audits the change", async () => {
    const response = await patch({ linkSurveyBranding: false });

    expect(response.status).toBe(200);
    expect((await response.json()).data).toEqual({
      workspaceId: WORKSPACE_ID,
      linkSurveyBranding: false,
      inAppSurveyBranding: true,
    });
    expect(checkedActions()).toEqual([["workspace.manage", { type: "workspace", id: WORKSPACE_ID }]]);
    expect(operationLimits()).toEqual([[rateLimitConfigs.actions.stateMutation.namespace, WORKSPACE_ID]]);
    expect(mocks.getRemoveBrandingPermission).toHaveBeenCalledWith(ORG_ID);
    expect(mocks.updateWorkspaceBranding).toHaveBeenCalledWith(WORKSPACE_ID, { linkSurveyBranding: false });
    expect(mocks.queueAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "updated",
        targetType: "workspace",
        status: "success",
        organizationId: ORG_ID,
        targetId: WORKSPACE_ID,
        oldObject: expect.objectContaining({ linkSurveyBranding: true }),
        newObject: expect.objectContaining({ linkSurveyBranding: false }),
      })
    );
  });

  test("records removing the branding in PostHog, once per badge turned off", async () => {
    await patch({ linkSurveyBranding: false, inAppSurveyBranding: false });

    expect(
      mocks.capturePostHogEvent.mock.calls.map(([, event, props]) => [event, props.branding_type])
    ).toEqual([
      ["remove_branding_enabled", "link"],
      ["remove_branding_enabled", "in_app"],
    ]);
    expect(mocks.capturePostHogEvent).toHaveBeenCalledWith(
      USER_ID,
      "remove_branding_enabled",
      { organization_id: ORG_ID, workspace_id: WORKSPACE_ID, branding_type: "link" },
      { organizationId: ORG_ID, workspaceId: WORKSPACE_ID }
    );
  });

  test("records nothing in PostHog when the badge is shown again", async () => {
    mocks.getWorkspace.mockReset().mockResolvedValue(workspace({ inAppSurveyBranding: false }));
    expect((await patch({ inAppSurveyBranding: true })).status).toBe(200);
    expect(mocks.capturePostHogEvent).not.toHaveBeenCalled();
  });

  test("refuses a caller who can't manage the workspace with 403, and audits it against the workspace", async () => {
    mocks.assertCan.mockRejectedValue(new AuthorizationError("Forbidden"));

    expect((await patch({ linkSurveyBranding: false })).status).toBe(403);
    expect(mocks.updateWorkspaceBranding).not.toHaveBeenCalled();
    expect(mocks.getRemoveBrandingPermission).not.toHaveBeenCalled();
    expect(operationLimits()).toEqual([]);
    expect(mocks.queueAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "updated",
        targetType: "workspace",
        status: "failure",
        organizationId: ORG_ID,
        targetId: WORKSPACE_ID,
      })
    );
  });

  test("answers 403 for a workspace that does not exist, the same as for one the caller can't see", async () => {
    mocks.getWorkspace.mockReset().mockResolvedValue(null);
    mocks.resolveWorkspace.mockRejectedValue(new ResourceNotFoundError("workspace", WORKSPACE_ID));

    const response = await patch({ linkSurveyBranding: false });

    expect(response.status).toBe(403);
    expect(mocks.updateWorkspaceBranding).not.toHaveBeenCalled();
    expect(mocks.queueAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ status: "failure", targetId: WORKSPACE_ID })
    );
  });

  test.each([
    ["in-app branding", { inAppSurveyBranding: false }, "You are not allowed to remove in-app branding"],
    ["link branding", { linkSurveyBranding: false }, "You are not allowed to remove link survey branding"],
    [
      "both",
      { linkSurveyBranding: false, inAppSurveyBranding: false },
      "You are not allowed to remove in-app branding",
    ],
    [
      "re-showing the badge",
      { linkSurveyBranding: true },
      "You are not allowed to remove link survey branding",
    ],
  ])("refuses %s without the licence, after authorizing the caller", async (_label, body, detail) => {
    mocks.getRemoveBrandingPermission.mockResolvedValue(false);

    const response = await patch(body);

    expect(response.status).toBe(403);
    expect((await response.json()).detail).toBe(detail);
    expect(checkedActions()).toEqual([["workspace.manage", { type: "workspace", id: WORKSPACE_ID }]]);
    expect(mocks.updateWorkspaceBranding).not.toHaveBeenCalled();
    expect(mocks.queueAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ status: "failure", organizationId: ORG_ID, targetId: WORKSPACE_ID })
    );
  });

  test("answers 403 when the organization is gone by the time the licence is checked", async () => {
    mocks.getOrganization.mockResolvedValue(null);
    expect((await patch({ linkSurveyBranding: false })).status).toBe(403);
    expect(mocks.updateWorkspaceBranding).not.toHaveBeenCalled();
  });

  test("answers 429 once the workspace's settings-write budget is spent, and changes nothing", async () => {
    mocks.applyRateLimit.mockImplementation(async (config: { namespace: string }) => {
      if (config.namespace === rateLimitConfigs.actions.stateMutation.namespace) {
        throw new TooManyRequestsError("Maximum number of requests reached. Please try again later.", 60);
      }
    });

    const response = await patch({ linkSurveyBranding: false });

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("60");
    expect(mocks.updateWorkspaceBranding).not.toHaveBeenCalled();
  });

  test.each([
    ["no field", {}],
    ["a non-boolean value", { linkSurveyBranding: "no" }],
    ["a field this route never writes", { linkSurveyBranding: false, name: "Renamed" }],
  ])("answers 400 for %s", async (_label, body) => {
    expect((await patch(body)).status).toBe(400);
    expect(mocks.updateWorkspaceBranding).not.toHaveBeenCalled();
  });

  test("answers 400 for a malformed workspace id", async () => {
    expect((await patch({ linkSurveyBranding: false }, { id: "not a cuid" })).status).toBe(400);
  });

  test("answers 401 without a session", async () => {
    mocks.getSession.mockResolvedValue(null);
    expect((await patch({ linkSurveyBranding: false })).status).toBe(401);
    expect(mocks.updateWorkspaceBranding).not.toHaveBeenCalled();
  });

  test("refuses a cross-site request (CSRF)", async () => {
    const response = await patch(
      { linkSurveyBranding: false },
      { headers: { "sec-fetch-site": "cross-site" } }
    );
    expect(response.status).toBe(403);
    expect(mocks.updateWorkspaceBranding).not.toHaveBeenCalled();
  });
});
