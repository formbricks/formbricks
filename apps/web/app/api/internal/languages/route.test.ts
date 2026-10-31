import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  AuthorizationError,
  DatabaseError,
  OperationNotAllowedError,
  ResourceNotFoundError,
  TooManyRequestsError,
  ValidationError,
} from "@formbricks/types/errors";
import { SAME_ORIGIN_HEADERS } from "@/app/api/v3/lib/test-utils";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import { DELETE, PATCH } from "./[languageId]/route";
import { GET as SURVEYS } from "./[languageId]/surveys/route";
import { POST as CREATE } from "./route";

const mocks = vi.hoisted(() => ({
  assertCan: vi.fn(),
  getSession: vi.fn(),
  resolveWorkspace: vi.fn(),
  getOrganizationIdFromWorkspaceId: vi.fn(),
  getWorkspaceIdFromLanguageId: vi.fn(),
  applyRateLimit: vi.fn(),
  queueAuditEvent: vi.fn(),
  capturePostHogEvent: vi.fn(),
  getUserVisibleSurveyWhere: vi.fn(),
  language: {
    createLanguage: vi.fn(),
    deleteLanguage: vi.fn(),
    getLanguage: vi.fn(),
    getSurveysUsingGivenLanguage: vi.fn(),
    updateLanguage: vi.fn(),
  },
}));

vi.mock("@/lib/authorization", () => ({ assertCan: mocks.assertCan, can: vi.fn() }));
vi.mock("@/app/api/v3/lib/workspace-context", () => ({ resolveV3WorkspaceContext: mocks.resolveWorkspace }));
vi.mock("@/lib/utils/helper", () => ({
  getOrganizationIdFromWorkspaceId: mocks.getOrganizationIdFromWorkspaceId,
  getWorkspaceIdFromLanguageId: mocks.getWorkspaceIdFromLanguageId,
}));
vi.mock("@/lib/language/service", () => mocks.language);
vi.mock("@/lib/posthog", () => ({ capturePostHogEvent: mocks.capturePostHogEvent }));
vi.mock("@/lib/survey/visibility/actor-context", () => ({
  getUserVisibleSurveyWhere: mocks.getUserVisibleSurveyWhere,
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

const USER_ID = "cluser1111111111111111111";
const WORKSPACE_ID = "clwork1111111111111111111";
const OTHER_WORKSPACE_ID = "clwork2222222222222222222";
const ORG_ID = "clorg11111111111111111111";
const LANGUAGE_ID = "cllang1111111111111111111";
const CREATED_AT = new Date("2026-10-01T10:00:00.000Z");
const VISIBLE_SURVEY_WHERE = { OR: [{ visibility: "workspace" as const }, { ownerId: USER_ID }] };

const row = (overrides: Record<string, unknown> = {}) => ({
  id: LANGUAGE_ID,
  code: "de-DE",
  alias: null,
  workspaceId: WORKSPACE_ID,
  createdAt: CREATED_AT,
  updatedAt: CREATED_AT,
  ...overrides,
});

const resource = (overrides: Record<string, unknown> = {}) => ({
  id: LANGUAGE_ID,
  code: "de-DE",
  alias: null,
  createdAt: CREATED_AT.toISOString(),
  updatedAt: CREATED_AT.toISOString(),
  ...overrides,
});

type TRequestOptions = { headers?: Record<string, string> };

const request = (method: string, url: string, body?: unknown, { headers }: TRequestOptions = {}) =>
  new NextRequest(url, {
    method,
    headers: {
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      ...SAME_ORIGIN_HEADERS,
      ...headers,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

const base = "http://localhost/api/internal/languages";
const languageProps = (id = LANGUAGE_ID) => ({ params: Promise.resolve({ languageId: id }) }) as never;
const noProps = { params: Promise.resolve({}) } as never;

const create = (body: unknown, workspaceId = WORKSPACE_ID, options?: TRequestOptions) =>
  CREATE(request("POST", `${base}?workspaceId=${workspaceId}`, body, options), noProps);
const update = (body: unknown, id = LANGUAGE_ID, options?: TRequestOptions) =>
  PATCH(request("PATCH", `${base}/${id}`, body, options), languageProps(id));
const remove = (id = LANGUAGE_ID, options?: TRequestOptions) =>
  DELETE(request("DELETE", `${base}/${id}`, undefined, options), languageProps(id));
const surveys = (id = LANGUAGE_ID) => SURVEYS(request("GET", `${base}/${id}/surveys`), languageProps(id));

const actor = { type: "user", id: USER_ID };
const lastAudit = () => mocks.queueAuditEvent.mock.calls.at(-1)?.[0];
const withoutRequestId = async (response: Response) => {
  const { requestId: _requestId, ...rest } = await response.json();
  return rest;
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getSession.mockResolvedValue({ user: { id: USER_ID } });
  mocks.assertCan.mockResolvedValue(undefined);
  mocks.resolveWorkspace.mockImplementation(async (workspaceId: string) => ({
    workspaceId,
    organizationId: ORG_ID,
  }));
  mocks.getOrganizationIdFromWorkspaceId.mockResolvedValue(ORG_ID);
  mocks.getWorkspaceIdFromLanguageId.mockResolvedValue(WORKSPACE_ID);
  mocks.applyRateLimit.mockResolvedValue(undefined);
  mocks.getUserVisibleSurveyWhere.mockResolvedValue(VISIBLE_SURVEY_WHERE);
  mocks.language.createLanguage.mockResolvedValue(row());
  mocks.language.getLanguage.mockResolvedValue(row());
  mocks.language.updateLanguage.mockResolvedValue(row({ alias: "german" }));
  mocks.language.deleteLanguage.mockResolvedValue(row());
  mocks.language.getSurveysUsingGivenLanguage.mockResolvedValue(["Onboarding", "NPS"]);
});

describe("authorization", () => {
  test.each([
    ["create", () => create({ code: "de", alias: null })],
    ["update", () => update({ alias: "german" })],
    ["delete", () => remove()],
    ["surveys", () => surveys()],
  ])("%s asks for workspace.manage, as the server action did", async (_name, send) => {
    expect((await send()).ok).toBe(true);
    expect(mocks.assertCan).toHaveBeenCalledWith(actor, "workspace.manage", {
      type: "workspace",
      id: WORKSPACE_ID,
    });
  });

  test.each([
    ["create", () => create({ code: "de", alias: null })],
    ["update", () => update({ alias: "german" })],
    ["delete", () => remove()],
    ["surveys", () => surveys()],
  ])("%s refuses a caller without workspace.manage with 403 and touches nothing", async (_name, send) => {
    mocks.assertCan.mockImplementation(async (_actor: unknown, action: string) => {
      if (action === "workspace.manage") throw new AuthorizationError("Not authorized");
    });

    expect((await send()).status).toBe(403);
    expect(mocks.applyRateLimit).not.toHaveBeenCalledWith(
      rateLimitConfigs.actions.stateMutation,
      expect.anything()
    );
    for (const service of Object.values(mocks.language)) expect(service).not.toHaveBeenCalled();
  });

  test.each([
    ["update", () => update({ alias: "german" })],
    ["delete", () => remove()],
    ["surveys", () => surveys()],
  ])("%s authorizes against the workspace that owns the language", async (_name, send) => {
    mocks.getWorkspaceIdFromLanguageId.mockResolvedValue(OTHER_WORKSPACE_ID);

    expect((await send()).ok).toBe(true);
    expect(mocks.assertCan).toHaveBeenCalledWith(actor, "workspace.manage", {
      type: "workspace",
      id: OTHER_WORKSPACE_ID,
    });
    expect(mocks.assertCan).not.toHaveBeenCalledWith(actor, "workspace.manage", {
      type: "workspace",
      id: WORKSPACE_ID,
    });
  });

  test.each([
    ["update", () => update({ alias: "german" })],
    ["delete", () => remove()],
    ["surveys", () => surveys()],
  ])("%s answers a language that doesn't exist with the same 403 as another tenant's", async (_n, send) => {
    mocks.getWorkspaceIdFromLanguageId.mockRejectedValue(new ResourceNotFoundError("language", LANGUAGE_ID));
    const missing = await send();
    expect(mocks.assertCan).not.toHaveBeenCalled();

    mocks.getWorkspaceIdFromLanguageId.mockResolvedValue(OTHER_WORKSPACE_ID);
    mocks.assertCan.mockRejectedValue(new AuthorizationError("Not authorized"));
    const otherTenant = await send();

    expect(missing.status).toBe(403);
    expect(otherTenant.status).toBe(403);
    expect(await withoutRequestId(missing)).toEqual(await withoutRequestId(otherTenant));
  });

  test("create answers a workspace that doesn't exist with the same 403 as one the caller can't manage", async () => {
    mocks.getOrganizationIdFromWorkspaceId.mockRejectedValue(
      new ResourceNotFoundError("workspace", OTHER_WORKSPACE_ID)
    );
    const missing = await create({ code: "de", alias: null }, OTHER_WORKSPACE_ID);

    mocks.getOrganizationIdFromWorkspaceId.mockResolvedValue(ORG_ID);
    mocks.assertCan.mockRejectedValue(new AuthorizationError("Not authorized"));
    const unmanaged = await create({ code: "de", alias: null }, OTHER_WORKSPACE_ID);

    expect(missing.status).toBe(403);
    expect(await withoutRequestId(missing)).toEqual(await withoutRequestId(unmanaged));
    expect(mocks.language.createLanguage).not.toHaveBeenCalled();
  });

  test("refuses cross-site writes (CSRF)", async () => {
    const crossSite = { headers: { "sec-fetch-site": "cross-site" } };

    expect((await create({ code: "de", alias: null }, WORKSPACE_ID, crossSite)).status).toBe(403);
    expect((await update({ alias: "german" }, LANGUAGE_ID, crossSite)).status).toBe(403);
    expect((await remove(LANGUAGE_ID, crossSite)).status).toBe(403);
    expect(mocks.language.createLanguage).not.toHaveBeenCalled();
    expect(mocks.language.updateLanguage).not.toHaveBeenCalled();
    expect(mocks.language.deleteLanguage).not.toHaveBeenCalled();
  });

  test("answers 401 without a session", async () => {
    mocks.getSession.mockResolvedValue(null);
    expect((await create({ code: "de", alias: null })).status).toBe(401);
    expect(mocks.language.createLanguage).not.toHaveBeenCalled();
  });
});

describe("audit", () => {
  test.each([
    ["update", () => update({ alias: "german" }), "updated"],
    ["delete", () => remove(), "deleted"],
  ])("a refused %s names its target and organization in a failure entry", async (_n, send, action) => {
    mocks.assertCan.mockRejectedValue(new AuthorizationError("Not authorized"));

    expect((await send()).status).toBe(403);
    expect(lastAudit()).toMatchObject({
      action,
      targetType: "language",
      status: "failure",
      organizationId: ORG_ID,
      targetId: LANGUAGE_ID,
    });
  });

  test("a refused create names the organization in a failure entry", async () => {
    mocks.assertCan.mockRejectedValue(new AuthorizationError("Not authorized"));

    expect((await create({ code: "de", alias: null })).status).toBe(403);
    expect(lastAudit()).toMatchObject({
      action: "created",
      targetType: "language",
      status: "failure",
      organizationId: ORG_ID,
    });
  });

  test("the survey list is a read and records no audit event", async () => {
    await surveys();
    expect(mocks.queueAuditEvent).not.toHaveBeenCalled();
  });
});

describe("writes", () => {
  test("create passes the language on, answers 201 with a Location, audits and reports the new row", async () => {
    const response = await create({ code: "de", alias: "german" });

    expect(response.status).toBe(201);
    expect(response.headers.get("Location")).toBe(`/api/internal/languages/${LANGUAGE_ID}`);
    expect((await response.json()).data).toEqual(resource());
    expect(mocks.language.createLanguage).toHaveBeenCalledWith(WORKSPACE_ID, { code: "de", alias: "german" });
    expect(mocks.applyRateLimit).toHaveBeenCalledWith(rateLimitConfigs.actions.stateMutation, WORKSPACE_ID);
    expect(lastAudit()).toMatchObject({
      action: "created",
      targetType: "language",
      status: "success",
      organizationId: ORG_ID,
      targetId: LANGUAGE_ID,
      newObject: row(),
    });
    expect(mocks.capturePostHogEvent).toHaveBeenCalledWith(
      USER_ID,
      "workspace_language_created",
      { organization_id: ORG_ID, workspace_id: WORKSPACE_ID, language_code: "de-DE" },
      { organizationId: ORG_ID, workspaceId: WORKSPACE_ID }
    );
  });

  test("update changes the alias only and audits both sides", async () => {
    const response = await update({ alias: "german" });

    expect(response.status).toBe(200);
    expect((await response.json()).data).toEqual(resource({ alias: "german" }));
    expect(mocks.language.updateLanguage).toHaveBeenCalledWith(WORKSPACE_ID, LANGUAGE_ID, {
      alias: "german",
    });
    expect(mocks.applyRateLimit).toHaveBeenCalledWith(rateLimitConfigs.actions.stateMutation, WORKSPACE_ID);
    expect(lastAudit()).toMatchObject({
      action: "updated",
      targetType: "language",
      status: "success",
      organizationId: ORG_ID,
      targetId: LANGUAGE_ID,
      oldObject: row(),
      newObject: row({ alias: "german" }),
    });
  });

  test("delete passes the caller's visibility clause, answers 204 and audits the removed row (ENG-3282)", async () => {
    const response = await remove();

    expect(response.status).toBe(204);
    expect(mocks.getUserVisibleSurveyWhere).toHaveBeenCalledWith(USER_ID, ORG_ID);
    expect(mocks.language.deleteLanguage).toHaveBeenCalledWith(
      LANGUAGE_ID,
      WORKSPACE_ID,
      VISIBLE_SURVEY_WHERE
    );
    expect(mocks.applyRateLimit).toHaveBeenCalledWith(rateLimitConfigs.actions.stateMutation, WORKSPACE_ID);
    expect(lastAudit()).toMatchObject({
      action: "deleted",
      targetType: "language",
      status: "success",
      organizationId: ORG_ID,
      targetId: LANGUAGE_ID,
      oldObject: row(),
    });
  });
});

describe("surveys using a language", () => {
  test("names only the surveys this caller may see (ENG-3282)", async () => {
    const response = await surveys();

    expect(response.status).toBe(200);
    expect((await response.json()).data).toEqual([{ name: "Onboarding" }, { name: "NPS" }]);
    expect(mocks.getUserVisibleSurveyWhere).toHaveBeenCalledWith(USER_ID, ORG_ID);
    expect(mocks.language.getSurveysUsingGivenLanguage).toHaveBeenCalledWith(
      LANGUAGE_ID,
      VISIBLE_SURVEY_WHERE
    );
  });

  test("spends no write budget", async () => {
    await surveys();
    expect(mocks.applyRateLimit).not.toHaveBeenCalledWith(
      rateLimitConfigs.actions.stateMutation,
      expect.anything()
    );
  });
});

describe("refusals", () => {
  test("a code outside the catalog is a 400 carrying the service's message", async () => {
    mocks.language.createLanguage.mockRejectedValue(new ValidationError("Unsupported language code: 'xx'"));
    const response = await create({ code: "xx", alias: null });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.detail).toBe("Unsupported language code: 'xx'");
    expect(body.invalid_params).toEqual([{ name: "code", reason: "Unsupported language code: 'xx'" }]);
    expect(lastAudit()).toMatchObject({ action: "created", status: "failure" });
  });

  test("a language surveys still use is a 409 whose message the page shows, audited as a failure", async () => {
    const message =
      "This language is still used by Onboarding and 1 survey you can't see. Remove the language from those surveys before deleting it.";
    mocks.language.deleteLanguage.mockRejectedValue(new OperationNotAllowedError(message));
    const response = await remove();

    expect(response.status).toBe(409);
    expect((await response.json()).detail).toBe(message);
    expect(lastAudit()).toMatchObject({ action: "deleted", status: "failure", targetId: LANGUAGE_ID });
  });

  test("the workspace's default survey language is a 409", async () => {
    mocks.language.deleteLanguage.mockRejectedValue(
      new OperationNotAllowedError(
        "This language is the workspace's default survey language and cannot be removed"
      )
    );
    expect((await remove()).status).toBe(409);
  });

  test("a language deleted mid-request answers the same 403 as one the caller can't reach", async () => {
    mocks.language.updateLanguage.mockRejectedValue(new ResourceNotFoundError("Language", LANGUAGE_ID));
    expect((await update({ alias: "german" })).status).toBe(403);
  });

  test("a database failure is a 500 that relays nothing", async () => {
    mocks.language.createLanguage.mockRejectedValue(
      new DatabaseError('Unique constraint failed on the fields: ("workspaceId","code") db-7.internal')
    );
    const response = await create({ code: "de", alias: null });

    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain("db-7.internal");
  });

  test.each([
    ["create", () => create({ code: "de", alias: null })],
    ["update", () => update({ alias: "german" })],
    ["delete", () => remove()],
  ])("%s answers 429 once the workspace's write budget is spent", async (_n, send) => {
    mocks.applyRateLimit.mockRejectedValue(new TooManyRequestsError("Rate limit exceeded", 30));

    expect((await send()).status).toBe(429);
    expect(mocks.language.createLanguage).not.toHaveBeenCalled();
    expect(mocks.language.updateLanguage).not.toHaveBeenCalled();
    expect(mocks.language.deleteLanguage).not.toHaveBeenCalled();
  });

  test.each([
    ["a code change, which is immutable", () => update({ code: "fr", alias: null })],
    ["an update without an alias", () => update({})],
    ["a create without a code", () => create({ alias: null })],
    ["a create with an empty code", () => create({ code: "", alias: null })],
    ["an over-long alias", () => create({ code: "de", alias: "a".repeat(256) })],
    ["an unknown field", () => create({ code: "de", alias: null, workspaceId: OTHER_WORKSPACE_ID })],
    ["a malformed workspace id", () => create({ code: "de", alias: null }, "not a cuid")],
    ["a malformed language id", () => remove("not a cuid")],
  ])("answers 400 for %s", async (_label, send) => {
    expect((await send()).status).toBe(400);
    expect(mocks.language.createLanguage).not.toHaveBeenCalled();
    expect(mocks.language.updateLanguage).not.toHaveBeenCalled();
    expect(mocks.language.deleteLanguage).not.toHaveBeenCalled();
  });
});
