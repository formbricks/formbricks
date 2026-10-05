import { beforeEach, describe, expect, test, vi } from "vitest";
import type { TCustomCssStored } from "@formbricks/types/custom-css";
import { skipV3AuditLog } from "@/app/api/v3/lib/audit";
import { requireV3WorkspaceAccess } from "@/app/api/v3/lib/auth";
import { problemForbidden } from "@/app/api/v3/lib/response";
import { can } from "@/lib/authorization";
import { getCustomCssHealth } from "@/modules/custom-css/lib/delivery";
import { getWorkspaceCustomCssRecord, updateWorkspaceCustomCss } from "@/modules/custom-css/lib/service";
import { getCustomCssPermission } from "@/modules/ee/license-check/lib/utils";
import { getV3WorkspaceCustomCss, patchV3WorkspaceCustomCss } from "./custom-css";

vi.mock("server-only", () => ({}));

vi.mock("@formbricks/logger", () => ({
  logger: { withContext: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })) },
}));

vi.mock("@/app/api/v3/lib/auth", () => ({
  getV3AuthorizationActor: (authentication: { apiKeyId?: string; user?: { id: string } } | null) => {
    if (authentication?.user) return { type: "user", id: authentication.user.id };
    if (authentication?.apiKeyId) return { type: "apiKey", id: authentication.apiKeyId };
    return null;
  },
  requireV3WorkspaceAccess: vi.fn(),
}));

vi.mock("@/app/api/v3/lib/audit", () => ({ skipV3AuditLog: vi.fn() }));

// The real role rules in `access.ts` run against a mocked authorization engine and plan.
vi.mock("@/lib/authorization", () => ({ can: vi.fn() }));
vi.mock("@/modules/ee/license-check/lib/utils", () => ({ getCustomCssPermission: vi.fn() }));
vi.mock("@/modules/custom-css/lib/delivery", () => ({ getCustomCssHealth: vi.fn() }));
vi.mock("@/modules/custom-css/lib/service", async () => {
  const { toCustomCssSource } = await vi.importActual<typeof import("@/modules/custom-css/lib/source")>(
    "@/modules/custom-css/lib/source"
  );
  return { toCustomCssSource, getWorkspaceCustomCssRecord: vi.fn(), updateWorkspaceCustomCss: vi.fn() };
});

const workspaceId = "tz4a98xxat96iws9zmbrgj3a";
const requestId = "req_1";
const instance = "/api/v3/workspaces/custom-css";
const context = { workspaceId, organizationId: "org_1" };
const owner = { user: { id: "user_owner" }, expires: "2099-01-01" } as never;
const member = { user: { id: "user_member" }, expires: "2099-01-01" } as never;
const manageKey = { apiKeyId: "key_manage", organizationId: "org_1", workspacePermissions: [] } as never;
const writeKey = { apiKeyId: "key_write", organizationId: "org_1", workspacePermissions: [] } as never;

const stored = (light: string): TCustomCssStored => ({
  light: { source: light, compiled: `@layer fb-workspace{${light}}` },
  dark: null,
  processorVersion: 1,
});

const warning = {
  code: "font_face_removed" as const,
  scope: "workspace" as const,
  appearance: "light" as const,
  line: 1,
  column: 1,
  reason: "@font-face is not supported",
};

/** Owners/managers hold `organization.manage`; only the manage-level key holds `workspace.manage`. */
const grant = async (actor: { type: string; id: string }, action: string) =>
  (actor.id === "user_owner" && action === "organization.manage") ||
  (actor.id === "key_manage" && action === "workspace.manage");

const readJson = async (response: Response) => response.json();

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(requireV3WorkspaceAccess).mockResolvedValue(context);
  vi.mocked(can).mockImplementation(grant as never);
  vi.mocked(getCustomCssPermission).mockResolvedValue(true);
  vi.mocked(getCustomCssHealth).mockResolvedValue({ status: "ok" });
  vi.mocked(getWorkspaceCustomCssRecord).mockResolvedValue({ customCss: stored("a{}"), previous: null });
  vi.mocked(updateWorkspaceCustomCss).mockResolvedValue({
    ok: true,
    stored: stored("b{}"),
    warnings: [warning],
    changed: true,
  });
});

describe("getV3WorkspaceCustomCss", () => {
  test("returns source, previous, status and what this caller may do — never compiled output", async () => {
    vi.mocked(getWorkspaceCustomCssRecord).mockResolvedValue({
      customCss: stored("a{}"),
      previous: stored("old{}"),
    });

    const response = await getV3WorkspaceCustomCss({
      workspaceId,
      authentication: member,
      requestId,
      instance,
    });

    expect(vi.mocked(requireV3WorkspaceAccess)).toHaveBeenCalledWith(
      member,
      workspaceId,
      "read",
      requestId,
      instance
    );
    expect(await readJson(response)).toEqual({
      data: {
        workspaceId,
        customCss: { light: "a{}", dark: null },
        previous: { light: "old{}", dark: null },
        status: "ok",
        canEdit: false,
        planAllowed: true,
      },
    });
  });

  test("reports withheld CSS with its errors", async () => {
    const errors = [
      {
        code: "limit_exceeded" as const,
        scope: "workspace" as const,
        appearance: null,
        line: null,
        column: null,
        reason: "Too many rules",
      },
    ];
    vi.mocked(getCustomCssHealth).mockResolvedValue({ status: "withheld", errors });

    const { data } = await readJson(
      await getV3WorkspaceCustomCss({ workspaceId, authentication: owner, requestId, instance })
    );

    expect(data).toMatchObject({ status: "withheld", errors, canEdit: true });
  });

  test("a caller without workspace read access gets the access problem and no data", async () => {
    vi.mocked(requireV3WorkspaceAccess).mockResolvedValue(problemForbidden(requestId, "nope", instance));

    const response = await getV3WorkspaceCustomCss({
      workspaceId,
      authentication: member,
      requestId,
      instance,
    });

    expect(response.status).toBe(403);
    expect(getWorkspaceCustomCssRecord).not.toHaveBeenCalled();
  });
});

describe("patchV3WorkspaceCustomCss", () => {
  const patch = (authentication: never, body: unknown, auditLog?: Record<string, unknown>) =>
    patchV3WorkspaceCustomCss({
      workspaceId,
      body,
      authentication,
      requestId,
      instance,
      auditLog: auditLog as never,
    });

  test.each([
    ["an organization owner or manager", owner],
    ["an API key with manage access", manageKey],
  ])("%s may save; the warnings come back beside the resource", async (_label, authentication) => {
    vi.mocked(getWorkspaceCustomCssRecord)
      .mockResolvedValueOnce({ customCss: stored("a{}"), previous: null })
      .mockResolvedValueOnce({ customCss: stored("b{}"), previous: stored("a{}") });

    const response = await patch(authentication, { customCss: { light: "b{}", dark: null } });

    expect(response.status).toBe(200);
    expect(updateWorkspaceCustomCss).toHaveBeenCalledWith({
      workspaceId,
      organizationId: "org_1",
      input: { light: "b{}", dark: null },
    });
    expect(await readJson(response)).toMatchObject({
      data: { customCss: { light: "b{}", dark: null }, previous: { light: "a{}", dark: null } },
      warnings: [warning],
    });
  });

  test.each([
    ["a member, or a team's workspace manage grant", member],
    ["an API key with a read & write grant", writeKey],
  ])("%s is refused before anything is processed", async (_label, authentication) => {
    const response = await patch(authentication, { customCss: { light: "b{}", dark: null } });

    expect(response.status).toBe(403);
    expect(await readJson(response)).toMatchObject({ code: "forbidden" });
    expect(updateWorkspaceCustomCss).not.toHaveBeenCalled();
  });

  test("an API key's manage grant is checked on this workspace, a user's role on its organization", async () => {
    await patch(manageKey, { customCss: null });
    await patch(owner, { customCss: null });

    expect(can).toHaveBeenCalledWith({ type: "apiKey", id: "key_manage" }, "workspace.manage", {
      type: "workspace",
      id: workspaceId,
    });
    expect(can).toHaveBeenCalledWith({ type: "user", id: "user_owner" }, "organization.manage", {
      type: "organization",
      id: "org_1",
    });
  });

  test("a workspace the caller cannot read is refused like any other v3 resource", async () => {
    vi.mocked(requireV3WorkspaceAccess).mockResolvedValue(problemForbidden(requestId, "nope", instance));

    const response = await patch(owner, { customCss: null });

    expect(response.status).toBe(403);
    expect(updateWorkspaceCustomCss).not.toHaveBeenCalled();
  });

  test.each([
    ["compiled output", { customCss: { light: "a{}", dark: null, compiled: "x" } }],
    ["a processor version", { customCss: { light: "a{}", dark: null, processorVersion: 9 } }],
    ["a missing key", { customCss: { light: "a{}" } }],
    ["no customCss at all", {}],
    ["an oversized field", { customCss: { light: "a".repeat(100_001), dark: null } }],
  ])("rejects %s with 400 before authorization or processing", async (_label, body) => {
    const response = await patch(owner, body);

    expect(response.status).toBe(400);
    expect(requireV3WorkspaceAccess).not.toHaveBeenCalled();
    expect(updateWorkspaceCustomCss).not.toHaveBeenCalled();
  });

  test("names the unsupported key", async () => {
    const response = await patch(owner, { customCss: { light: "a{}", dark: null, compiled: "x" } });

    expect((await readJson(response)).invalid_params).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "customCss.compiled", code: "unsupported_field" }),
      ])
    );
  });

  test("a plan refusal is a 403 with custom_css_plan_required", async () => {
    vi.mocked(updateWorkspaceCustomCss).mockResolvedValue({ ok: false, code: "plan_required" });

    const response = await patch(owner, { customCss: { light: "b{}", dark: null } });

    expect(response.status).toBe(403);
    expect(await readJson(response)).toMatchObject({ code: "custom_css_plan_required" });
  });

  test("rejected CSS is a 422 with located errors, and the saved CSS is left as it was", async () => {
    const error = { ...warning, code: "syntax_error" as const, line: 4, column: 2, reason: "Unexpected" };
    vi.mocked(updateWorkspaceCustomCss).mockResolvedValue({
      ok: false,
      code: "invalid_css",
      errors: [error],
    });

    const response = await patch(owner, { customCss: { light: "b{", dark: null } });

    expect(response.status).toBe(422);
    expect(await readJson(response)).toMatchObject({
      invalid_params: [{ name: "customCss.light", reason: "Unexpected (line 4, column 2)" }],
      details: { errors: [error] },
    });
    expect(getWorkspaceCustomCssRecord).toHaveBeenCalledTimes(1);
  });

  test("a change is audited as source on both sides", async () => {
    vi.mocked(getWorkspaceCustomCssRecord)
      .mockResolvedValueOnce({ customCss: stored("a{}"), previous: null })
      .mockResolvedValueOnce({ customCss: stored("b{}"), previous: stored("a{}") });
    const auditLog: Record<string, unknown> = {};

    await patch(owner, { customCss: { light: "b{}", dark: null } }, auditLog);

    expect(auditLog).toMatchObject({
      organizationId: "org_1",
      targetId: workspaceId,
      oldObject: { customCss: { light: "a{}", dark: null } },
      newObject: { customCss: { light: "b{}", dark: null } },
    });
    expect(skipV3AuditLog).not.toHaveBeenCalled();
  });

  test("an unchanged save is not audited", async () => {
    vi.mocked(updateWorkspaceCustomCss).mockResolvedValue({
      ok: true,
      stored: stored("a{}"),
      warnings: [],
      changed: false,
    });
    const auditLog = {};

    await patch(owner, { customCss: { light: "a{}", dark: null } }, auditLog);

    expect(skipV3AuditLog).toHaveBeenCalledWith(auditLog);
  });

  test("clearing is allowed without the plan", async () => {
    vi.mocked(getCustomCssPermission).mockResolvedValue(false);
    vi.mocked(updateWorkspaceCustomCss).mockResolvedValue({
      ok: true,
      stored: null,
      warnings: [],
      changed: true,
    });

    const response = await patch(owner, { customCss: null });

    expect(response.status).toBe(200);
    expect(updateWorkspaceCustomCss).toHaveBeenCalledWith(expect.objectContaining({ input: null }));
  });
});
