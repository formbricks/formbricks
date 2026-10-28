import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { OperationNotAllowedError, TooManyRequestsError } from "@formbricks/types/errors";
import { SAME_ORIGIN_HEADERS } from "@/app/api/v3/lib/test-utils";
import { DELETE, PATCH } from "./route";

const mocks = vi.hoisted(() => ({
  can: vi.fn(),
  getSession: vi.fn(),
  getWorkspace: vi.fn(),
  getOrganization: vi.fn(),
  getRemoveBrandingPermission: vi.fn(),
  updateWorkspace: vi.fn(),
  deleteWorkspaceIfNotLast: vi.fn(),
  resolvePostWorkspaceDeletionDestination: vi.fn(),
  capturePostHogEvent: vi.fn(),
  applyRateLimit: vi.fn(),
  queueAuditEvent: vi.fn(),
}));

vi.mock("@/lib/authorization", () => ({ can: mocks.can }));
vi.mock("@/lib/workspace/service", () => ({ getWorkspace: mocks.getWorkspace }));
vi.mock("@/lib/organization/service", () => ({ getOrganization: mocks.getOrganization }));
vi.mock("@/modules/ee/license-check/lib/utils", () => ({
  getRemoveBrandingPermission: mocks.getRemoveBrandingPermission,
}));
vi.mock("@/modules/workspaces/settings/lib/workspace", () => ({
  updateWorkspace: mocks.updateWorkspace,
  deleteWorkspaceIfNotLast: mocks.deleteWorkspaceIfNotLast,
}));
vi.mock("@/modules/workspaces/settings/general/lib/delete-workspace", () => ({
  resolvePostWorkspaceDeletionDestination: mocks.resolvePostWorkspaceDeletionDestination,
}));
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
  logger: {
    withContext: vi.fn(() => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn() })),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));
vi.mock("server-only", () => ({}));

const WORKSPACE_ID = "clws111111111111111111111";
const ORG_ID = "clorg11111111111111111111";
const USER_ID = "cluser1111111111111111111";
const STATE_MUTATION_NAMESPACE = "action:state-mutation";

const workspace = (overrides: Record<string, unknown> = {}) => ({
  id: WORKSPACE_ID,
  createdAt: new Date("2026-10-01T10:00:00.000Z"),
  updatedAt: new Date("2026-10-01T10:00:00.000Z"),
  name: "Acme Workspace",
  organizationId: ORG_ID,
  styling: { allowStyleOverwrite: true },
  recontactDays: 7,
  inAppSurveyBranding: true,
  linkSurveyBranding: true,
  config: { channel: "link", industry: "saas", defaultSurveyLanguage: null },
  placement: "bottomRight",
  clickOutsideClose: true,
  overlay: "none",
  overlayColor: null,
  overlayOpacity: null,
  languages: [{ code: "de-DE" }],
  appSetupCompleted: false,
  logo: null,
  customHeadScripts: null,
  ...overrides,
});

const url = (id = WORKSPACE_ID) => `http://localhost/api/internal/workspaces/${id}`;
const props = (id = WORKSPACE_ID) => ({ params: Promise.resolve({ workspaceId: id }) });

type TRequestOptions = { id?: string; headers?: Record<string, string> };

const send = (method: "PATCH" | "DELETE", body: unknown, { id = WORKSPACE_ID, headers }: TRequestOptions) =>
  (method === "PATCH" ? PATCH : DELETE)(
    new NextRequest(url(id), {
      method,
      headers: { "Content-Type": "application/json", ...(headers ?? SAME_ORIGIN_HEADERS) },
      body: JSON.stringify(body),
    }),
    props(id) as never
  );

const patch = (body: unknown, options: TRequestOptions = {}) => send("PATCH", body, options);
const remove = (body: unknown = { confirmationName: "acme workspace" }, options: TRequestOptions = {}) =>
  send("DELETE", body, options);

/** Grant exactly these actions. */
const allow = (...actions: string[]) =>
  mocks.can.mockImplementation(async (_actor: unknown, action: string) => actions.includes(action));

const checks = () => mocks.can.mock.calls.map(([actor, action, resource]) => ({ actor, action, resource }));

const auditEvent = () => mocks.queueAuditEvent.mock.calls.at(-1)?.[0];

const stateMutationCalls = () =>
  mocks.applyRateLimit.mock.calls.filter(([config]) => config.namespace === STATE_MUTATION_NAMESPACE);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getSession.mockResolvedValue({ user: { id: USER_ID } });
  allow("workspace.manage", "organization.manage");
  mocks.applyRateLimit.mockResolvedValue(undefined);
  mocks.getWorkspace.mockResolvedValue(workspace());
  mocks.getOrganization.mockResolvedValue({ id: ORG_ID });
  mocks.getRemoveBrandingPermission.mockResolvedValue(true);
  mocks.updateWorkspace.mockImplementation(async (_id: string, data: Record<string, unknown>) =>
    workspace({ ...data, updatedAt: new Date("2026-10-02T10:00:00.000Z") })
  );
  mocks.deleteWorkspaceIfNotLast.mockResolvedValue(workspace());
  mocks.resolvePostWorkspaceDeletionDestination.mockResolvedValue({
    workspaceId: "clws222222222222222222222",
    path: "/workspaces/clws222222222222222222222/",
  });
});

describe("PATCH /api/internal/workspaces/{workspaceId}", () => {
  test("lets a workspace manager rename it, audits the change, and returns the settings only", async () => {
    const response = await patch({ name: "  Renamed  " });

    expect(response.status).toBe(200);
    const { data } = await response.json();
    expect(data).toMatchObject({ id: WORKSPACE_ID, name: "Renamed", updatedAt: "2026-10-02T10:00:00.000Z" });
    expect(data).not.toHaveProperty("organizationId");
    expect(data).not.toHaveProperty("languages");
    expect(checks()).toEqual([
      {
        actor: { type: "user", id: USER_ID },
        action: "workspace.manage",
        resource: { type: "workspace", id: WORKSPACE_ID },
      },
    ]);
    expect(mocks.updateWorkspace).toHaveBeenCalledWith(WORKSPACE_ID, { name: "Renamed" });
    expect(auditEvent()).toMatchObject({
      action: "updated",
      targetType: "workspace",
      status: "success",
      organizationId: ORG_ID,
      targetId: WORKSPACE_ID,
      oldObject: expect.objectContaining({ name: "Acme Workspace" }),
      newObject: expect.objectContaining({ name: "Renamed" }),
    });
  });

  test("refuses a caller without workspace.manage with 403, and audits the refusal against the workspace", async () => {
    allow("workspace.write", "organization.manage");

    expect((await patch({ name: "Renamed" })).status).toBe(403);
    expect(checks().map(({ action }) => action)).toEqual(["workspace.manage"]);
    expect(mocks.updateWorkspace).not.toHaveBeenCalled();
    expect(stateMutationCalls()).toEqual([]);
    expect(auditEvent()).toMatchObject({
      action: "updated",
      targetType: "workspace",
      status: "failure",
      organizationId: ORG_ID,
      targetId: WORKSPACE_ID,
    });
  });

  test("answers 403 for a workspace that doesn't exist, the same as for one the caller can't see", async () => {
    mocks.getWorkspace.mockResolvedValue(null);

    const response = await patch({ name: "Renamed" });

    expect(response.status).toBe(403);
    expect(mocks.can).not.toHaveBeenCalled();
    expect(mocks.updateWorkspace).not.toHaveBeenCalled();
  });

  test("charges the state-mutation budget to the workspace, and answers 429 when it is spent", async () => {
    expect((await patch({ recontactDays: 3 })).status).toBe(200);
    expect(stateMutationCalls()).toEqual([[expect.anything(), WORKSPACE_ID]]);

    mocks.applyRateLimit.mockImplementation(async (config: { namespace: string }) => {
      if (config.namespace === STATE_MUTATION_NAMESPACE) throw new TooManyRequestsError("Slow down", 30);
    });
    const limited = await patch({ recontactDays: 3 });

    expect(limited.status).toBe(429);
    expect(limited.headers.get("Retry-After")).toBe("30");
    expect(mocks.updateWorkspace).toHaveBeenCalledTimes(1);
  });

  test("lets a licensed organization remove link survey branding, and records that it did", async () => {
    expect((await patch({ linkSurveyBranding: false })).status).toBe(200);

    expect(mocks.getRemoveBrandingPermission).toHaveBeenCalledWith(ORG_ID);
    expect(mocks.capturePostHogEvent).toHaveBeenCalledWith(
      USER_ID,
      "remove_branding_enabled",
      { organization_id: ORG_ID, workspace_id: WORKSPACE_ID, branding_type: "link" },
      { organizationId: ORG_ID, workspaceId: WORKSPACE_ID }
    );
  });

  test.each([
    ["in-app", { inAppSurveyBranding: false }, "You are not allowed to remove in-app branding"],
    ["link survey", { linkSurveyBranding: false }, "You are not allowed to remove link survey branding"],
  ])("refuses to change %s branding without the licence, after authorizing", async (_label, body, detail) => {
    mocks.getRemoveBrandingPermission.mockResolvedValue(false);

    const response = await patch(body);

    expect(response.status).toBe(403);
    expect((await response.json()).detail).toBe(detail);
    expect(mocks.updateWorkspace).not.toHaveBeenCalled();
  });

  test("checks no licence for a caller who may not manage the workspace anyway", async () => {
    allow();
    expect((await patch({ inAppSurveyBranding: false })).status).toBe(403);
    expect(mocks.getRemoveBrandingPermission).not.toHaveBeenCalled();
  });

  test("checks no licence for a change that leaves branding alone", async () => {
    expect((await patch({ name: "Renamed" })).status).toBe(200);
    expect(mocks.getRemoveBrandingPermission).not.toHaveBeenCalled();
  });

  describe("default survey language (ENG-2816)", () => {
    test("accepts a language the workspace has, merged onto the stored config", async () => {
      // The caller sends only the key it is changing. `config` is a JSON column that Prisma replaces
      // wholesale, so what the route does not carry over from the *stored* config is dropped.
      expect((await patch({ config: { defaultSurveyLanguage: "de-DE" } })).status).toBe(200);
      expect(mocks.updateWorkspace).toHaveBeenCalledWith(WORKSPACE_ID, {
        config: { channel: "link", industry: "saas", defaultSurveyLanguage: "de-DE" },
      });
    });

    test("accepts a language the workspace stores under a legacy code", async () => {
      mocks.getWorkspace.mockResolvedValue(workspace({ languages: [{ code: "de" }] }));
      expect((await patch({ config: { defaultSurveyLanguage: "de-DE" } })).status).toBe(200);
    });

    test("accepts clearing the setting", async () => {
      mocks.getWorkspace.mockResolvedValue(workspace({ languages: [], config: {} }));
      expect((await patch({ config: { defaultSurveyLanguage: null } })).status).toBe(200);
      expect(mocks.updateWorkspace).toHaveBeenCalledWith(WORKSPACE_ID, {
        config: { defaultSurveyLanguage: null },
      });
    });

    test("answers 422 for a language the workspace does not have", async () => {
      const response = await patch({ config: { defaultSurveyLanguage: "tr-TR" } });

      expect(response.status).toBe(422);
      expect((await response.json()).invalid_params).toEqual([
        expect.objectContaining({ name: "config.defaultSurveyLanguage" }),
      ]);
      expect(mocks.updateWorkspace).not.toHaveBeenCalled();
    });

    test("answers 400 for a language the survey runtime ships no strings for", async () => {
      const response = await patch({ config: { defaultSurveyLanguage: "fa-IR" } });

      expect(response.status).toBe(400);
      expect((await response.json()).invalid_params).toEqual([
        expect.objectContaining({ name: "config.defaultSurveyLanguage" }),
      ]);
      expect(mocks.can).not.toHaveBeenCalled();
    });
  });

  test("passes a logo write's baseline through, and answers 409 when the workspace changed since", async () => {
    const logo = { url: "https://example.com/logo.png" };
    const body = { logo, expectedUpdatedAt: "2026-10-01T10:00:00.000Z" };
    expect((await patch(body)).status).toBe(200);
    expect(mocks.updateWorkspace).toHaveBeenCalledWith(WORKSPACE_ID, {
      logo,
      expectedUpdatedAt: new Date("2026-10-01T10:00:00.000Z"),
    });

    const stale = "This workspace was changed somewhere else. Reload the page and try again.";
    mocks.updateWorkspace.mockRejectedValueOnce(new OperationNotAllowedError(stale));
    const response = await patch(body);

    expect(response.status).toBe(409);
    expect((await response.json()).detail).toBe(stale);
  });

  test.each([
    ["no field", {}],
    ["only the baseline", { expectedUpdatedAt: "2026-10-01T10:00:00.000Z" }],
    ["a blank name", { name: "   " }],
    ["a logo without the baseline", { logo: { url: "https://example.com/logo.png" } }],
    [
      "organizationId, the tenant anchor (ENG-1919)",
      { name: "Moved", organizationId: "clorg22222222222222222222" },
    ],
    [
      "teamIds, which is not a workspace setting",
      { name: "Renamed", teamIds: ["clteam1111111111111111111"] },
    ],
    ["custom CSS, which has its own resource (ENG-2949)", { name: "Renamed", customCss: "body{}" }],
  ])("answers 400 for %s", async (_label, body) => {
    expect((await patch(body)).status).toBe(400);
    expect(mocks.updateWorkspace).not.toHaveBeenCalled();
  });

  test("answers 400 for a malformed workspace id", async () => {
    expect((await patch({ name: "x" }, { id: "not a cuid" })).status).toBe(400);
  });

  test("answers 401 without a session", async () => {
    mocks.getSession.mockResolvedValue(null);
    expect((await patch({ name: "x" })).status).toBe(401);
    expect(mocks.updateWorkspace).not.toHaveBeenCalled();
  });

  test("refuses a cross-site request (CSRF)", async () => {
    expect((await patch({ name: "x" }, { headers: { "sec-fetch-site": "cross-site" } })).status).toBe(403);
    expect(mocks.updateWorkspace).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/internal/workspaces/{workspaceId}", () => {
  test("lets an organization manager delete it, answers the next destination, and audits it", async () => {
    const response = await remove();

    expect(response.status).toBe(200);
    expect((await response.json()).data).toEqual({
      destination: {
        workspaceId: "clws222222222222222222222",
        path: "/workspaces/clws222222222222222222222/",
      },
    });
    expect(checks()).toEqual([
      {
        actor: { type: "user", id: USER_ID },
        action: "organization.manage",
        resource: { type: "organization", id: ORG_ID },
      },
    ]);
    expect(mocks.deleteWorkspaceIfNotLast).toHaveBeenCalledWith(WORKSPACE_ID, ORG_ID);
    expect(mocks.resolvePostWorkspaceDeletionDestination).toHaveBeenCalledWith(
      expect.objectContaining({ id: WORKSPACE_ID, organizationId: ORG_ID })
    );
    expect(auditEvent()).toMatchObject({
      action: "deleted",
      targetType: "workspace",
      status: "success",
      organizationId: ORG_ID,
      targetId: WORKSPACE_ID,
      oldObject: expect.objectContaining({ name: "Acme Workspace" }),
    });
  });

  test("refuses a caller without organization.manage with 403, and audits the refusal", async () => {
    allow("workspace.manage");

    expect((await remove()).status).toBe(403);
    expect(mocks.deleteWorkspaceIfNotLast).not.toHaveBeenCalled();
    expect(auditEvent()).toMatchObject({
      action: "deleted",
      status: "failure",
      organizationId: ORG_ID,
      targetId: WORKSPACE_ID,
    });
  });

  test("answers 403 for a workspace that doesn't exist", async () => {
    mocks.getWorkspace.mockResolvedValue(null);
    expect((await remove()).status).toBe(403);
    expect(mocks.deleteWorkspaceIfNotLast).not.toHaveBeenCalled();
  });

  test("answers 422 when the typed name doesn't match, without deleting", async () => {
    const response = await remove({ confirmationName: "Other Workspace" });

    expect(response.status).toBe(422);
    expect((await response.json()).detail).toBe("Workspace name confirmation does not match");
    expect(mocks.deleteWorkspaceIfNotLast).not.toHaveBeenCalled();
  });

  test("says nothing about the name of a workspace the caller can't delete", async () => {
    allow();
    const response = await remove({ confirmationName: "Other Workspace" });

    expect(response.status).toBe(403);
    expect((await response.json()).detail).not.toContain("confirmation");
  });

  test("answers 409 for the organization's last workspace", async () => {
    mocks.deleteWorkspaceIfNotLast.mockRejectedValue(
      new OperationNotAllowedError("You can't delete the last workspace.")
    );

    const response = await remove();

    expect(response.status).toBe(409);
    expect((await response.json()).detail).toBe("You can't delete the last workspace.");
    expect(mocks.resolvePostWorkspaceDeletionDestination).not.toHaveBeenCalled();
  });

  test.each([
    ["no confirmation", {}],
    ["a blank confirmation", { confirmationName: "   " }],
    ["an unknown field", { confirmationName: "acme workspace", force: true }],
  ])("answers 400 for %s", async (_label, body) => {
    expect((await remove(body)).status).toBe(400);
    expect(mocks.deleteWorkspaceIfNotLast).not.toHaveBeenCalled();
  });

  test("refuses a cross-site request (CSRF)", async () => {
    expect((await remove(undefined, { headers: { "sec-fetch-site": "cross-site" } })).status).toBe(403);
    expect(mocks.deleteWorkspaceIfNotLast).not.toHaveBeenCalled();
  });
});
