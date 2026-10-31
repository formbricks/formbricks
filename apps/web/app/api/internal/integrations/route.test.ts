import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  AuthenticationError,
  AuthorizationError,
  OperationNotAllowedError,
  UnknownError,
} from "@formbricks/types/errors";
import { SAME_ORIGIN_HEADERS } from "@/app/api/v3/lib/test-utils";
import { SURVEY_NOT_WORKSPACE_VISIBLE_MESSAGE } from "@/lib/survey/visibility/outbound";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import { GET as CHANNELS } from "./[type]/channels/route";
import { GET as CONNECTION } from "./[type]/connection/route";
import { DELETE, PUT } from "./[type]/route";
import { GET as SPREADSHEET } from "./[type]/spreadsheets/[spreadsheetId]/route";

const mocks = vi.hoisted(() => ({
  assertCan: vi.fn(),
  getSession: vi.fn(),
  resolveWorkspace: vi.fn(),
  applyRateLimit: vi.fn(),
  queueAuditEvent: vi.fn(),
  capturePostHogEvent: vi.fn(),
  getIntegrationByType: vi.fn(),
  createOrUpdateIntegration: vi.fn(),
  deleteIntegration: vi.fn(),
  validateGoogleSheetsConnection: vi.fn(),
  getSpreadsheetNameById: vi.fn(),
  getSlackChannels: vi.fn(),
}));

vi.mock("@/lib/authorization", () => ({ assertCan: mocks.assertCan, can: vi.fn() }));
vi.mock("@/app/api/v3/lib/workspace-context", () => ({ resolveV3WorkspaceContext: mocks.resolveWorkspace }));
vi.mock("@/lib/integration/service", () => ({
  getIntegrationByType: mocks.getIntegrationByType,
  createOrUpdateIntegration: mocks.createOrUpdateIntegration,
  deleteIntegration: mocks.deleteIntegration,
}));
vi.mock("@/lib/googleSheet/service", () => ({
  validateGoogleSheetsConnection: mocks.validateGoogleSheetsConnection,
  getSpreadsheetNameById: mocks.getSpreadsheetNameById,
}));
vi.mock("@/lib/slack/service", () => ({ getSlackChannels: mocks.getSlackChannels }));
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
const INTEGRATION_ID = "clint11111111111111111111";
const SURVEY_ID = "clsurv1111111111111111111";
const STORED_KEY = {
  app_id: "A1",
  authed_user: { id: "U1" },
  token_type: "bot",
  access_token: "stored-access",
  bot_user_id: "B1",
  team: { id: "T1", name: "Acme" },
};

const slackMapping = {
  createdAt: "2026-10-01T10:00:00.000Z",
  elementIds: ["q1"],
  elements: "All questions",
  surveyId: SURVEY_ID,
  surveyName: "Onboarding",
  channelId: "C123",
  channelName: "feedback",
};
const storedSlack = (overrides: Record<string, unknown> = {}) => ({
  id: INTEGRATION_ID,
  type: "slack",
  workspaceId: WORKSPACE_ID,
  config: { key: STORED_KEY, data: [] },
  ...overrides,
});

type TOptions = { headers?: Record<string, string> };
const send = (method: string, url: string, body?: unknown, { headers }: TOptions = {}) =>
  new NextRequest(url, {
    method,
    headers: {
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      ...(headers ?? SAME_ORIGIN_HEADERS),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
const base = "http://localhost/api/internal/integrations";
const typeProps = (type: string) => ({ params: Promise.resolve({ type }) }) as never;
const query = `?workspaceId=${WORKSPACE_ID}`;

const put = (body: unknown, type = "slack", options?: TOptions) =>
  PUT(send("PUT", `${base}/${type}${query}`, body, options), typeProps(type));
const remove = (type = "slack") => DELETE(send("DELETE", `${base}/${type}${query}`), typeProps(type));
const connection = (type = "googleSheets") =>
  CONNECTION(send("GET", `${base}/${type}/connection${query}`), typeProps(type));
const spreadsheet = (type = "googleSheets", id = "sheet-1") =>
  SPREADSHEET(send("GET", `${base}/${type}/spreadsheets/${id}${query}`), {
    params: Promise.resolve({ type, spreadsheetId: id }),
  } as never);
const channels = (type = "slack") =>
  CHANNELS(send("GET", `${base}/${type}/channels${query}`), typeProps(type));

const lastAudit = () => mocks.queueAuditEvent.mock.calls.at(-1)?.[0];

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getSession.mockResolvedValue({ user: { id: USER_ID } });
  mocks.assertCan.mockResolvedValue(undefined);
  mocks.resolveWorkspace.mockImplementation(async (workspaceId: string) => ({
    workspaceId,
    organizationId: ORG_ID,
  }));
  mocks.applyRateLimit.mockResolvedValue(undefined);
  mocks.getIntegrationByType.mockResolvedValue(storedSlack());
  mocks.createOrUpdateIntegration.mockResolvedValue(
    storedSlack({ config: { key: STORED_KEY, data: [slackMapping] } })
  );
  mocks.deleteIntegration.mockResolvedValue(storedSlack());
  mocks.validateGoogleSheetsConnection.mockResolvedValue(undefined);
  mocks.getSpreadsheetNameById.mockResolvedValue("Q4 feedback");
  mocks.getSlackChannels.mockResolvedValue([{ id: "C123", name: "feedback" }]);
});

describe("PUT /api/internal/integrations/{type}", () => {
  test("stores the mappings with the stored credentials, whatever key the client sent, and answers only the id", async () => {
    // What the settings page echoes back: the stored key with its secrets blanked, or here a forgery.
    const response = await put({ config: { key: { access_token: "forged" }, data: [slackMapping] } });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toEqual({ id: INTEGRATION_ID });
    expect(JSON.stringify(body)).not.toContain("stored-access");
    expect(mocks.assertCan).toHaveBeenCalledWith({ type: "user", id: USER_ID }, "workspace.write", {
      type: "workspace",
      id: WORKSPACE_ID,
    });
    const [workspaceId, input] = mocks.createOrUpdateIntegration.mock.calls[0];
    expect(workspaceId).toBe(WORKSPACE_ID);
    expect(input.type).toBe("slack");
    expect(input.config.key).toEqual(STORED_KEY);
    // The mapping's ISO timestamp is revived into the Date the integration schemas expect.
    expect(input.config.data[0].createdAt).toEqual(new Date(slackMapping.createdAt));
    expect(mocks.applyRateLimit).toHaveBeenCalledWith(rateLimitConfigs.actions.integrationMutation, USER_ID);
    expect(lastAudit()).toMatchObject({
      action: "createdUpdated",
      targetType: "integration",
      status: "success",
      organizationId: ORG_ID,
      targetId: INTEGRATION_ID,
    });
  });

  test("refuses to configure an integration that was never connected, even with a well-formed key", async () => {
    // A complete Slack credential: it would pass the schema, so only the "connect first" rule stops it.
    mocks.getIntegrationByType.mockResolvedValue(null);
    const response = await put({
      config: { key: { ...STORED_KEY, access_token: "attacker-token" }, data: [] },
    });

    expect(response.status).toBe(409);
    expect((await response.json()).details).toEqual({ reason: "not_connected" });
    expect(mocks.createOrUpdateIntegration).not.toHaveBeenCalled();
  });

  test("writes the stored key back exactly as stored, including fields the schema doesn't name", async () => {
    const storedKey = { ...STORED_KEY, scope: "chat:write", enterprise: null };
    mocks.getIntegrationByType.mockResolvedValue(storedSlack({ config: { key: storedKey, data: [] } }));

    await put({ config: { key: { access_token: "" }, data: [slackMapping] } });

    expect(mocks.createOrUpdateIntegration.mock.calls[0][1].config.key).toEqual(storedKey);
  });

  test("refuses a mapping to a survey restricted to some members (ENG-3283), with its own message", async () => {
    mocks.createOrUpdateIntegration.mockRejectedValue(
      new OperationNotAllowedError(SURVEY_NOT_WORKSPACE_VISIBLE_MESSAGE)
    );
    const response = await put({ config: { key: {}, data: [slackMapping] } });
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.code).toBe("survey_not_workspace_visible");
    expect(body.detail).toBe(SURVEY_NOT_WORKSPACE_VISIBLE_MESSAGE);
  });

  test("records the integration_connected event", async () => {
    await put({ config: { key: {}, data: [slackMapping] } });

    expect(mocks.capturePostHogEvent).toHaveBeenCalledWith(
      USER_ID,
      "integration_connected",
      { integration_type: "slack", organization_id: ORG_ID, workspace_id: WORKSPACE_ID },
      { organizationId: ORG_ID, workspaceId: WORKSPACE_ID }
    );
  });

  test("refuses a caller without write access to the workspace, and stores nothing", async () => {
    mocks.assertCan.mockRejectedValue(new AuthorizationError("Not authorized"));
    expect((await put({ config: { key: {}, data: [] } })).status).toBe(403);
    expect(mocks.createOrUpdateIntegration).not.toHaveBeenCalled();
  });

  test("answers 400 naming the field for a configuration the type's schema refuses", async () => {
    const response = await put({ config: { key: {}, data: [{ ...slackMapping, channelId: 42 }] } });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.invalid_params.map((param: { name: string }) => param.name)).toContain(
      "config.data.0.channelId"
    );
    expect(mocks.createOrUpdateIntegration).not.toHaveBeenCalled();
  });

  test.each([
    ["an integration type it doesn't manage", () => put({ config: {} }, "n8n")],
    ["a body that isn't a configuration", () => put({ type: "slack", config: {} })],
  ])("answers 400 for %s", async (_label, call) => {
    expect((await call()).status).toBe(400);
    expect(mocks.createOrUpdateIntegration).not.toHaveBeenCalled();
  });

  test("refuses a cross-site request (CSRF)", async () => {
    const response = await put({ config: { key: {}, data: [] } }, "slack", {
      headers: { "sec-fetch-site": "cross-site" },
    });
    expect(response.status).toBe(403);
    expect(mocks.createOrUpdateIntegration).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/internal/integrations/{type}", () => {
  test("disconnects the workspace's integration of that type, with a 204 and an audit entry", async () => {
    const response = await remove();

    expect(response.status).toBe(204);
    expect(mocks.getIntegrationByType).toHaveBeenCalledWith(WORKSPACE_ID, "slack");
    expect(mocks.deleteIntegration).toHaveBeenCalledWith(INTEGRATION_ID);
    expect(mocks.applyRateLimit).toHaveBeenCalledWith(rateLimitConfigs.actions.integrationMutation, USER_ID);
    expect(lastAudit()).toMatchObject({ action: "deleted", status: "success", targetId: INTEGRATION_ID });
  });

  test("answers 404 when the workspace has no such integration", async () => {
    mocks.getIntegrationByType.mockResolvedValue(null);
    expect((await remove()).status).toBe(404);
    expect(mocks.deleteIntegration).not.toHaveBeenCalled();
  });

  test("refuses a caller without write access, before looking anything up", async () => {
    mocks.assertCan.mockRejectedValue(new AuthorizationError("Not authorized"));
    expect((await remove()).status).toBe(403);
    expect(mocks.getIntegrationByType).not.toHaveBeenCalled();
  });
});

describe("GET /api/internal/integrations/googleSheets/connection", () => {
  test.each([
    ["a working grant", () => undefined, "connected"],
    [
      "an expired grant",
      () => mocks.validateGoogleSheetsConnection.mockRejectedValue(new AuthenticationError("invalid_grant")),
      "reauthorization_required",
    ],
    ["no integration", () => mocks.getIntegrationByType.mockResolvedValue(null), "not_connected"],
  ])("reports %s", async (_label, arrange, status) => {
    arrange();
    const response = await connection();

    expect(response.status).toBe(200);
    expect((await response.json()).data).toEqual({ status });
  });

  test("is only for Google Sheets", async () => {
    expect((await connection("slack")).status).toBe(404);
  });
});

describe("GET /api/internal/integrations/googleSheets/spreadsheets/{spreadsheetId}", () => {
  test("reads the name with the workspace's stored integration", async () => {
    const stored = { id: INTEGRATION_ID, type: "googleSheets", config: { key: STORED_KEY } };
    mocks.getIntegrationByType.mockResolvedValue(stored);
    const response = await spreadsheet();

    expect(response.status).toBe(200);
    expect((await response.json()).data).toEqual({ id: "sheet-1", name: "Q4 feedback" });
    expect(mocks.getIntegrationByType).toHaveBeenCalledWith(WORKSPACE_ID, "googleSheets");
    expect(mocks.getSpreadsheetNameById).toHaveBeenCalledWith(stored, "sheet-1");
  });

  test.each([
    ["no integration", () => mocks.getIntegrationByType.mockResolvedValue(null), "not_connected"],
    [
      "an expired grant",
      () => mocks.getSpreadsheetNameById.mockRejectedValue(new AuthenticationError("invalid_grant")),
      "invalid_grant",
    ],
    [
      "a spreadsheet the grant can't open",
      () =>
        mocks.getSpreadsheetNameById.mockRejectedValue(
          new OperationNotAllowedError("insufficient_permission")
        ),
      "insufficient_permission",
    ],
    [
      "a grant without the Sheets scope",
      () =>
        mocks.getSpreadsheetNameById.mockRejectedValue(new OperationNotAllowedError("insufficient_scopes")),
      "insufficient_scopes",
    ],
  ])("answers 409 with the reason for %s", async (_label, arrange, reason) => {
    arrange();
    const response = await spreadsheet();

    expect(response.status).toBe(409);
    expect((await response.json()).details).toEqual({ reason });
  });

  test("answers 502 when Google fails, without relaying its text", async () => {
    mocks.getSpreadsheetNameById.mockRejectedValue(
      new UnknownError("Error while fetching spreadsheet data: boom")
    );
    const response = await spreadsheet();

    expect(response.status).toBe(502);
    expect(JSON.stringify(await response.json())).not.toContain("boom");
  });
});

describe("GET /api/internal/integrations/slack/channels", () => {
  test("lists the channels", async () => {
    const response = await channels();

    expect(response.status).toBe(200);
    expect((await response.json()).data).toEqual([{ id: "C123", name: "feedback" }]);
  });

  test.each(["invalid_auth", "missing_scope"])("asks for a reconnect when Slack answers %s", async (code) => {
    mocks.getSlackChannels.mockRejectedValue(new UnknownError(code));
    const response = await channels();

    expect(response.status).toBe(409);
    expect((await response.json()).details).toEqual({ reason: "reauthorization_required" });
  });

  test("answers 502 for any other Slack failure", async () => {
    mocks.getSlackChannels.mockRejectedValue(new UnknownError("ratelimited"));
    expect((await channels()).status).toBe(502);
  });

  test("refuses a caller without write access to the workspace", async () => {
    mocks.assertCan.mockRejectedValue(new AuthorizationError("Not authorized"));
    expect((await channels()).status).toBe(403);
    expect(mocks.getSlackChannels).not.toHaveBeenCalled();
  });

  test("is only for Slack", async () => {
    expect((await channels("notion")).status).toBe(404);
  });
});
