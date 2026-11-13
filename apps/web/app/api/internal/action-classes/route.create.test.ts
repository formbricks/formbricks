import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { AuthorizationError, TooManyRequestsError, UniqueConstraintError } from "@formbricks/types/errors";
import { SAME_ORIGIN_HEADERS } from "@/app/api/v3/lib/test-utils";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import { POST } from "./route";
import {
  ACTION_CLASS_ELEMENT_SELECTOR_MAX_LENGTH,
  ACTION_CLASS_KEY_MAX_LENGTH,
  ACTION_CLASS_URL_FILTERS_MAX,
} from "./schemas";

const mocks = vi.hoisted(() => ({
  assertCan: vi.fn(),
  getSession: vi.fn(),
  resolveWorkspace: vi.fn(),
  createActionClass: vi.fn(),
  applyRateLimit: vi.fn(),
  capturePostHogEvent: vi.fn(),
  queueAuditEvent: vi.fn(),
}));

vi.mock("@/lib/authorization", () => ({ assertCan: mocks.assertCan, can: vi.fn() }));
vi.mock("@/app/api/v3/lib/workspace-context", () => ({ resolveV3WorkspaceContext: mocks.resolveWorkspace }));
vi.mock("@/modules/survey/editor/lib/action-class", () => ({ createActionClass: mocks.createActionClass }));
vi.mock("@/lib/actionClass/service", () => ({
  getActionClass: vi.fn(),
  updateActionClass: vi.fn(),
  deleteActionClass: vi.fn(),
}));
vi.mock("@/lib/survey/service", () => ({ getSurveysByActionClassId: vi.fn() }));
vi.mock("@/lib/survey/visibility/actor-context", () => ({ getUserVisibleSurveyWhere: vi.fn() }));
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
const OTHER_WORKSPACE_ID = "clwork2222222222222222222";
const ACTION_ID = "clact11111111111111111111";
const CREATED_AT = new Date("2026-10-01T10:00:00.000Z");

const actor = { type: "user", id: USER_ID };
const noCodeInput = (overrides: Record<string, unknown> = {}) => ({
  name: "Clicked upgrade",
  description: null,
  type: "noCode",
  noCodeConfig: {
    type: "click",
    elementSelector: { cssSelector: ".upgrade" },
    urlFilters: [],
  },
  ...overrides,
});
const stored = (overrides: Record<string, unknown> = {}) => ({
  id: ACTION_ID,
  name: "Clicked upgrade",
  description: null,
  type: "noCode",
  key: null,
  noCodeConfig: noCodeInput().noCodeConfig,
  workspaceId: WORKSPACE_ID,
  createdAt: CREATED_AT,
  updatedAt: CREATED_AT,
  ...overrides,
});

const post = (
  body: unknown,
  {
    workspaceId = WORKSPACE_ID,
    headers = SAME_ORIGIN_HEADERS,
  }: { workspaceId?: string; headers?: Record<string, string> } = {}
) =>
  POST(
    new NextRequest(`http://localhost/api/internal/action-classes?workspaceId=${workspaceId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
    }),
    {} as never
  );
const lastAudit = () => mocks.queueAuditEvent.mock.calls.at(-1)?.[0];

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getSession.mockResolvedValue({ user: { id: USER_ID } });
  mocks.assertCan.mockResolvedValue(undefined);
  mocks.applyRateLimit.mockResolvedValue(undefined);
  mocks.resolveWorkspace.mockImplementation(async (workspaceId: string) => ({
    workspaceId,
    organizationId: ORG_ID,
  }));
  mocks.createActionClass.mockResolvedValue(stored());
});

describe("POST /api/internal/action-classes", () => {
  test("creates the action in the authorized workspace, answers 201 and audits it", async () => {
    const response = await post(noCodeInput());

    expect(response.status).toBe(201);
    expect(response.headers.get("Location")).toBe(`/api/internal/action-classes/${ACTION_ID}`);
    expect((await response.json()).data).toEqual({
      ...stored(),
      createdAt: CREATED_AT.toISOString(),
      updatedAt: CREATED_AT.toISOString(),
    });
    expect(mocks.assertCan).toHaveBeenCalledWith(actor, "workspace.write", {
      type: "workspace",
      id: WORKSPACE_ID,
    });
    expect(mocks.createActionClass).toHaveBeenCalledWith(WORKSPACE_ID, {
      ...noCodeInput(),
      workspaceId: WORKSPACE_ID,
    });
    expect(lastAudit()).toMatchObject({
      action: "created",
      targetType: "actionClass",
      status: "success",
      organizationId: ORG_ID,
      targetId: ACTION_ID,
      newObject: expect.objectContaining({ id: ACTION_ID }),
    });
    expect(mocks.capturePostHogEvent).toHaveBeenCalledWith(
      USER_ID,
      "action_class_created",
      { organization_id: ORG_ID, workspace_id: WORKSPACE_ID, type: "noCode", trigger_type: "click" },
      { organizationId: ORG_ID, workspaceId: WORKSPACE_ID }
    );
  });

  test("reports a code action's trigger type as codeAction", async () => {
    await post({
      name: "Signed up",
      description: null,
      type: "code",
      key: "signed-up",
    });

    expect(mocks.capturePostHogEvent).toHaveBeenCalledWith(
      USER_ID,
      "action_class_created",
      expect.objectContaining({ type: "code", trigger_type: "codeAction" }),
      expect.anything()
    );
  });

  test("answers with the action's own fields, never the surveys it triggers", async () => {
    mocks.createActionClass.mockResolvedValue({
      ...stored(),
      surveyTriggers: [{ surveyId: "clsurvrestricted111111111" }],
    });

    const data = (await (await post(noCodeInput())).json()).data;
    expect(JSON.stringify(data)).not.toContain("clsurvrestricted");
  });

  test("creates in the query's workspace, and refuses a body that names one with 400", async () => {
    await post(noCodeInput());
    expect(mocks.createActionClass).toHaveBeenCalledWith(
      WORKSPACE_ID,
      expect.objectContaining({ workspaceId: WORKSPACE_ID })
    );

    mocks.createActionClass.mockClear();
    expect((await post(noCodeInput({ workspaceId: OTHER_WORKSPACE_ID }))).status).toBe(400);
    expect(mocks.createActionClass).not.toHaveBeenCalled();
    expect(mocks.assertCan).not.toHaveBeenCalledWith(actor, expect.anything(), {
      type: "workspace",
      id: OTHER_WORKSPACE_ID,
    });
  });

  test("refuses a member without readWrite with 403, audited as a failure", async () => {
    mocks.assertCan.mockRejectedValue(new AuthorizationError("Not authorized"));

    expect((await post(noCodeInput())).status).toBe(403);
    expect(mocks.createActionClass).not.toHaveBeenCalled();
    expect(lastAudit()).toMatchObject({ action: "created", status: "failure" });
  });

  test("refuses another tenant's workspace with 403", async () => {
    mocks.assertCan.mockImplementation(async (_actor, _action, target: { id: string }) => {
      if (target.id === OTHER_WORKSPACE_ID) throw new AuthorizationError("Not authorized");
    });

    expect((await post(noCodeInput(), { workspaceId: OTHER_WORKSPACE_ID })).status).toBe(403);
    expect(mocks.createActionClass).not.toHaveBeenCalled();
  });

  test("refuses an unauthenticated caller with 401", async () => {
    mocks.getSession.mockResolvedValue(null);

    expect((await post(noCodeInput())).status).toBe(401);
    expect(mocks.createActionClass).not.toHaveBeenCalled();
  });

  test("refuses a cross-site request with 403", async () => {
    const response = await post(noCodeInput(), { headers: { "sec-fetch-site": "cross-site" } });

    expect(response.status).toBe(403);
    expect(mocks.createActionClass).not.toHaveBeenCalled();
  });

  test("spends the workspace's settings-write budget and answers 429 when it is spent", async () => {
    await post(noCodeInput());
    expect(mocks.applyRateLimit).toHaveBeenCalledWith(rateLimitConfigs.actions.stateMutation, WORKSPACE_ID);

    mocks.applyRateLimit.mockImplementation(async (config: { namespace: string }) => {
      if (config.namespace === rateLimitConfigs.actions.stateMutation.namespace) {
        throw new TooManyRequestsError("Maximum number of requests reached. Please try again later.");
      }
    });
    expect((await post(noCodeInput())).status).toBe(429);
    expect(mocks.createActionClass).toHaveBeenCalledTimes(1);
  });

  test("answers a name the workspace already uses with 409 and the service's message", async () => {
    mocks.createActionClass.mockRejectedValue(
      new UniqueConstraintError("Action with name Clicked upgrade already exists")
    );

    const response = await post(noCodeInput());
    expect(response.status).toBe(409);
    expect((await response.json()).detail).toBe("Action with name Clicked upgrade already exists");
  });

  test.each([
    ["a code action without a key", { name: "x", description: null, type: "code" }],
    ["an empty name", noCodeInput({ name: " " })],
    ["an unknown type", noCodeInput({ type: "magic" })],
  ])("answers 400 for %s", async (_label, body) => {
    expect((await post(body)).status).toBe(400);
    expect(mocks.createActionClass).not.toHaveBeenCalled();
  });

  test("answers 400 for a workspace id that is not an id", async () => {
    expect((await post(noCodeInput(), { workspaceId: "not-an-id" })).status).toBe(400);
    expect(mocks.createActionClass).not.toHaveBeenCalled();
  });
});

describe("POST /api/internal/action-classes input limits", () => {
  const text = (length: number) => "a".repeat(length);
  const clickInput = (config: Record<string, unknown>) =>
    noCodeInput({ noCodeConfig: { ...noCodeInput().noCodeConfig, ...config } });
  const urlFilter = (value: string) => ({ value, rule: "contains" });

  test.each([
    ["name", 255, (n: number) => noCodeInput({ name: text(n) })],
    ["description", 2000, (n: number) => noCodeInput({ description: text(n) })],
    [
      "key",
      ACTION_CLASS_KEY_MAX_LENGTH,
      (n: number) => ({ name: "Signed up", description: null, type: "code", key: text(n) }),
    ],
    [
      "noCodeConfig.urlFilters.0.value",
      2048,
      (n: number) => clickInput({ urlFilters: [urlFilter(text(n))] }),
    ],
    [
      "noCodeConfig.urlFilters",
      ACTION_CLASS_URL_FILTERS_MAX,
      (n: number) => clickInput({ urlFilters: Array.from({ length: n }, () => urlFilter("/a")) }),
    ],
    [
      "noCodeConfig.elementSelector.cssSelector",
      ACTION_CLASS_ELEMENT_SELECTOR_MAX_LENGTH,
      (n: number) => clickInput({ elementSelector: { cssSelector: text(n) } }),
    ],
    [
      "noCodeConfig.elementSelector.innerHtml",
      ACTION_CLASS_ELEMENT_SELECTOR_MAX_LENGTH,
      (n: number) => clickInput({ elementSelector: { innerHtml: text(n) } }),
    ],
  ])("takes %s at its cap of %i and answers 400 naming it one past", async (field, max, build) => {
    expect((await post(build(max))).status).toBe(201);

    mocks.createActionClass.mockClear();
    const response = await post(build(max + 1));
    expect(response.status).toBe(400);
    expect((await response.json()).invalid_params).toEqual([expect.objectContaining({ name: field })]);
    expect(mocks.createActionClass).not.toHaveBeenCalled();
  });
});
