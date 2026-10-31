import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { AuthorizationError } from "@formbricks/types/errors";
import { SAME_ORIGIN_HEADERS } from "@/app/api/v3/lib/test-utils";
import { DELETE, PATCH } from "./[actionClassId]/route";
import { GET as SURVEYS } from "./[actionClassId]/surveys/route";

const mocks = vi.hoisted(() => ({
  assertCan: vi.fn(),
  getSession: vi.fn(),
  resolveWorkspace: vi.fn(),
  getActionClass: vi.fn(),
  updateActionClass: vi.fn(),
  deleteActionClass: vi.fn(),
  getSurveysByActionClassId: vi.fn(),
  getUserVisibleSurveyWhere: vi.fn(),
  queueAuditEvent: vi.fn(),
}));

vi.mock("@/lib/authorization", () => ({ assertCan: mocks.assertCan, can: vi.fn() }));
vi.mock("@/app/api/v3/lib/workspace-context", () => ({ resolveV3WorkspaceContext: mocks.resolveWorkspace }));
vi.mock("@/lib/actionClass/service", () => ({
  getActionClass: mocks.getActionClass,
  updateActionClass: mocks.updateActionClass,
  deleteActionClass: mocks.deleteActionClass,
}));
vi.mock("@/lib/survey/service", () => ({ getSurveysByActionClassId: mocks.getSurveysByActionClassId }));
vi.mock("@/lib/survey/visibility/actor-context", () => ({
  getUserVisibleSurveyWhere: mocks.getUserVisibleSurveyWhere,
}));
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

const USER_ID = "cluser1111111111111111111";
const ORG_ID = "clorg11111111111111111111";
const WORKSPACE_ID = "clwork1111111111111111111";
const OTHER_WORKSPACE_ID = "clwork2222222222222222222";
const ACTION_ID = "clact11111111111111111111";
const CREATED_AT = new Date("2026-10-01T10:00:00.000Z");

const actor = { type: "user", id: USER_ID };
const actionClass = (overrides: Record<string, unknown> = {}) => ({
  id: ACTION_ID,
  name: "Clicked upgrade",
  description: null,
  type: "code",
  key: "clicked-upgrade",
  noCodeConfig: null,
  workspaceId: WORKSPACE_ID,
  createdAt: CREATED_AT,
  updatedAt: CREATED_AT,
  ...overrides,
});
const codeInput = (overrides: Record<string, unknown> = {}) => ({
  name: "Clicked upgrade button",
  description: null,
  type: "code",
  key: "clicked-upgrade",
  workspaceId: WORKSPACE_ID,
  ...overrides,
});

const send = (method: string, url: string, body?: unknown) =>
  new NextRequest(url, {
    method,
    headers: {
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      ...SAME_ORIGIN_HEADERS,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
const base = `http://localhost/api/internal/action-classes/${ACTION_ID}`;
const props = { params: Promise.resolve({ actionClassId: ACTION_ID }) } as never;

const patch = (body: unknown) => PATCH(send("PATCH", base, body), props);
const remove = () => DELETE(send("DELETE", base), props);
const surveys = (query = "") => SURVEYS(send("GET", `${base}/surveys${query}`), props);
const lastAudit = () => mocks.queueAuditEvent.mock.calls.at(-1)?.[0];

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getSession.mockResolvedValue({ user: { id: USER_ID } });
  mocks.assertCan.mockResolvedValue(undefined);
  mocks.resolveWorkspace.mockImplementation(async (workspaceId: string) => ({
    workspaceId,
    organizationId: ORG_ID,
  }));
  mocks.getActionClass.mockResolvedValue(actionClass());
  mocks.updateActionClass.mockResolvedValue(actionClass({ name: "Clicked upgrade button" }));
  mocks.deleteActionClass.mockResolvedValue(actionClass());
  mocks.getUserVisibleSurveyWhere.mockResolvedValue({ visible: true });
  mocks.getSurveysByActionClassId.mockResolvedValue([
    { id: "clsurv1111111111111111111", name: "Upgrade nudge", status: "inProgress" },
    { id: "clsurv2222222222222222222", name: "Old nudge", status: "completed" },
    { id: "clsurv3333333333333333333", name: "This survey", status: "draft" },
  ]);
});

describe("PATCH /api/internal/action-classes/{actionClassId}", () => {
  test("updates the action in its own workspace and audits both sides", async () => {
    const response = await patch(codeInput());

    expect(response.status).toBe(200);
    expect((await response.json()).data).toMatchObject({ id: ACTION_ID, name: "Clicked upgrade button" });
    expect(mocks.assertCan).toHaveBeenCalledWith(actor, "workspace.write", {
      type: "workspace",
      id: WORKSPACE_ID,
    });
    expect(mocks.updateActionClass).toHaveBeenCalledWith(WORKSPACE_ID, ACTION_ID, codeInput());
    expect(lastAudit()).toMatchObject({
      action: "updated",
      targetType: "actionClass",
      status: "success",
      organizationId: ORG_ID,
      targetId: ACTION_ID,
    });
  });

  test("answers with the action's own fields, never the surveys it triggers", async () => {
    mocks.updateActionClass.mockResolvedValue({
      ...actionClass(),
      surveyTriggers: [{ surveyId: "clsurvrestricted111111111" }],
    });
    const response = await patch(codeInput());

    const data = (await response.json()).data;
    expect(Object.keys(data).sort()).toEqual([
      "createdAt",
      "description",
      "id",
      "key",
      "name",
      "noCodeConfig",
      "type",
      "updatedAt",
      "workspaceId",
    ]);
    expect(JSON.stringify(data)).not.toContain("clsurvrestricted");
  });

  test("can't move an action to another workspace through the body", async () => {
    await patch(codeInput({ workspaceId: OTHER_WORKSPACE_ID }));

    expect(mocks.updateActionClass).toHaveBeenCalledWith(
      WORKSPACE_ID,
      ACTION_ID,
      expect.objectContaining({ workspaceId: WORKSPACE_ID })
    );
    expect(mocks.assertCan).not.toHaveBeenCalledWith(actor, expect.anything(), {
      type: "workspace",
      id: OTHER_WORKSPACE_ID,
    });
  });

  test("refuses a read-only member with 403", async () => {
    mocks.assertCan.mockRejectedValue(new AuthorizationError("Not authorized"));
    expect((await patch(codeInput())).status).toBe(403);
    expect(mocks.updateActionClass).not.toHaveBeenCalled();
  });

  test("answers a missing action with the same 403 as an unreachable one", async () => {
    mocks.getActionClass.mockResolvedValue(null);
    const missing = await patch(codeInput());
    mocks.getActionClass.mockResolvedValue(actionClass());
    mocks.assertCan.mockRejectedValue(new AuthorizationError("Not authorized"));
    const unreachable = await patch(codeInput());

    const strip = async (response: Response) => {
      const { requestId: _requestId, ...rest } = await response.json();
      return rest;
    };
    expect(missing.status).toBe(403);
    expect(await strip(missing)).toEqual(await strip(unreachable));
  });

  test("answers 400 for a code action without a key", async () => {
    expect((await patch(codeInput({ key: undefined }))).status).toBe(400);
    expect(mocks.updateActionClass).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/internal/action-classes/{actionClassId}", () => {
  test("deletes with a 204 and audits the deleted action", async () => {
    const response = await remove();

    expect(response.status).toBe(204);
    expect(mocks.deleteActionClass).toHaveBeenCalledWith(ACTION_ID);
    expect(lastAudit()).toMatchObject({ action: "deleted", status: "success", oldObject: actionClass() });
  });

  test("refuses a read-only member with 403", async () => {
    mocks.assertCan.mockRejectedValue(new AuthorizationError("Not authorized"));
    expect((await remove()).status).toBe(403);
    expect(mocks.deleteActionClass).not.toHaveBeenCalled();
  });
});

describe("GET /api/internal/action-classes/{actionClassId}/surveys", () => {
  test("names the surveys the action triggers, split by whether they run, for a reader", async () => {
    const response = await surveys();

    expect(response.status).toBe(200);
    expect((await response.json()).data).toEqual({
      activeSurveys: ["Upgrade nudge"],
      inactiveSurveys: ["Old nudge", "This survey"],
    });
    expect(mocks.assertCan).toHaveBeenCalledWith(actor, "workspace.read", {
      type: "workspace",
      id: WORKSPACE_ID,
    });
    // ENG-3282: only the surveys this caller may see.
    expect(mocks.getUserVisibleSurveyWhere).toHaveBeenCalledWith(USER_ID, ORG_ID);
    expect(mocks.getSurveysByActionClassId).toHaveBeenCalledWith(ACTION_ID, WORKSPACE_ID, { visible: true });
  });

  test("leaves out the survey being edited", async () => {
    const response = await surveys("?excludeSurveyId=clsurv3333333333333333333");

    expect((await response.json()).data.inactiveSurveys).toEqual(["Old nudge"]);
  });

  test("refuses a caller who can't read the workspace", async () => {
    mocks.assertCan.mockRejectedValue(new AuthorizationError("Not authorized"));
    expect((await surveys()).status).toBe(403);
    expect(mocks.getSurveysByActionClassId).not.toHaveBeenCalled();
  });
});
