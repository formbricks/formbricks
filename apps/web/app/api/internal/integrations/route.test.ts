import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  AuthenticationError,
  AuthorizationError,
  OperationNotAllowedError,
  ResourceNotFoundError,
  UnknownError,
} from "@formbricks/types/errors";
import { V3_INVALID_PARAMS_MAX } from "@/app/api/v3/lib/invalid-params";
import { SAME_ORIGIN_HEADERS } from "@/app/api/v3/lib/test-utils";
import { SlackApiError } from "@/lib/slack/errors";
import { SURVEY_NOT_WORKSPACE_VISIBLE_MESSAGE } from "@/lib/survey/visibility/outbound";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import { GET as CHANNELS } from "./[type]/channels/route";
import { GET as CONNECTION } from "./[type]/connection/route";
import { DELETE, PUT } from "./[type]/route";
import { GET as SPREADSHEET } from "./[type]/spreadsheets/[spreadsheetId]/route";
import { INTEGRATION_MAPPING_TEXT_MAX_LENGTH } from "./schemas";

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
/** Every route asks for write access to the workspace named in the query, and only that one. */
const expectWorkspaceWriteChecked = () =>
  expect(mocks.assertCan).toHaveBeenCalledWith({ type: "user", id: USER_ID }, "workspace.write", {
    type: "workspace",
    id: WORKSPACE_ID,
  });

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

const GOOGLE_KEY = {
  scope: "https://www.googleapis.com/auth/spreadsheets",
  token_type: "Bearer",
  expiry_date: 1,
  access_token: "stored-google-access",
  refresh_token: "stored-google-refresh",
};
const sheetsMapping = {
  createdAt: "2026-10-01T10:00:00.000Z",
  elementIds: ["q1"],
  elements: "All questions",
  surveyId: SURVEY_ID,
  surveyName: "Onboarding",
  spreadsheetId: "sheet-1",
  spreadsheetName: "Q4 feedback",
};
const notionMapping = {
  createdAt: "2026-10-01T10:00:00.000Z",
  surveyId: SURVEY_ID,
  surveyName: "Onboarding",
  databaseId: "db-1",
  databaseName: "Feedback",
  mapping: [
    {
      element: { id: "q1", name: "What did you like?", type: "openText" },
      column: { id: "c1", name: "Liked", type: "rich_text" },
    },
  ],
};

describe("PUT /api/internal/integrations/{type}", () => {
  test("stores the mappings on the stored integration, keeping its credentials, and answers only the id", async () => {
    const response = await put({ config: { data: [slackMapping] } });
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
    expect(input).toEqual({
      type: "slack",
      config: { key: STORED_KEY, data: [{ ...slackMapping, createdAt: new Date(slackMapping.createdAt) }] },
    });
    expect(mocks.applyRateLimit).toHaveBeenCalledWith(rateLimitConfigs.actions.integrationMutation, USER_ID);
    expect(lastAudit()).toMatchObject({
      action: "createdUpdated",
      targetType: "integration",
      status: "success",
      organizationId: ORG_ID,
      targetId: INTEGRATION_ID,
    });
  });

  test("keeps the connected account of a Google Sheets integration, and its key exactly as stored", async () => {
    const storedKey = { ...GOOGLE_KEY, id_token: "unnamed-by-the-schema" };
    mocks.getIntegrationByType.mockResolvedValue({
      id: INTEGRATION_ID,
      type: "googleSheets",
      workspaceId: WORKSPACE_ID,
      config: { key: storedKey, email: "owner@example.com", data: [] },
    });

    expect((await put({ config: { data: [sheetsMapping] } }, "googleSheets")).status).toBe(200);
    expect(mocks.createOrUpdateIntegration.mock.calls[0][1].config).toEqual({
      key: storedKey,
      email: "owner@example.com",
      data: [{ ...sheetsMapping, createdAt: new Date(sheetsMapping.createdAt) }],
    });
  });

  test("accepts a Notion mapping with its element-to-column pairs", async () => {
    mocks.getIntegrationByType.mockResolvedValue({
      id: INTEGRATION_ID,
      type: "notion",
      workspaceId: WORKSPACE_ID,
      config: { key: { access_token: "stored-notion" }, data: [] },
    });

    expect((await put({ config: { data: [notionMapping] } }, "notion")).status).toBe(200);
    expect(mocks.createOrUpdateIntegration.mock.calls[0][1].config.data[0].mapping).toEqual(
      notionMapping.mapping
    );
  });

  // Credentials and the connected account come from the OAuth callback alone. Silently dropping a sent
  // key would tell a caller it was taken; a 400 says it never is.
  test.each([
    ["slack", "the credentials", { key: { access_token: "forged" }, data: [slackMapping] }, "config.key"],
    [
      "googleSheets",
      "the connected account",
      { email: "attacker@example.com", data: [sheetsMapping] },
      "config.email",
    ],
  ])("refuses a %s body that sets %s, naming the field", async (type, _label, config, field) => {
    const response = await put({ config }, type);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.invalid_params.map((param: { name: string }) => param.name)).toContain(field);
    expect(mocks.createOrUpdateIntegration).not.toHaveBeenCalled();
  });

  test.each([
    [
      "an unknown field on a mapping",
      "slack",
      { ...slackMapping, channelID: "C999" },
      "config.data.0.channelID",
    ],
    [
      "an unknown field inside a Notion pair",
      "notion",
      {
        ...notionMapping,
        mapping: [{ ...notionMapping.mapping[0], column: { ...notionMapping.mapping[0].column, extra: 1 } }],
      },
      "config.data.0.mapping.0.column.extra",
    ],
    [
      "a timestamp that isn't ISO 8601",
      "slack",
      { ...slackMapping, createdAt: "yesterday" },
      "config.data.0.createdAt",
    ],
    ["a NULL byte", "slack", { ...slackMapping, surveyName: "On\u0000boarding" }, "config.data.0.surveyName"],
    [
      "text past its limit",
      "slack",
      { ...slackMapping, channelName: "c".repeat(INTEGRATION_MAPPING_TEXT_MAX_LENGTH + 1) },
      "config.data.0.channelName",
    ],
  ])("answers 400 for %s", async (_label, type, mapping, field) => {
    const response = await put({ config: { data: [mapping] } }, type);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.invalid_params.map((param: { name: string }) => param.name)).toContain(field);
    expect(mocks.getIntegrationByType).not.toHaveBeenCalled();
    expect(mocks.createOrUpdateIntegration).not.toHaveBeenCalled();
  });

  test("accepts text right at its limit", async () => {
    const channelName = "c".repeat(INTEGRATION_MAPPING_TEXT_MAX_LENGTH);
    expect((await put({ config: { data: [{ ...slackMapping, channelName }] } })).status).toBe(200);
  });

  test("refuses to configure an integration that was never connected", async () => {
    mocks.getIntegrationByType.mockResolvedValue(null);
    const response = await put({ config: { data: [] } });

    expect(response.status).toBe(409);
    expect((await response.json()).details).toEqual({ reason: "not_connected" });
    expect(mocks.createOrUpdateIntegration).not.toHaveBeenCalled();
  });

  test("refuses a mapping to a survey restricted to some members (ENG-3283), with its own message", async () => {
    mocks.createOrUpdateIntegration.mockRejectedValue(
      new OperationNotAllowedError(SURVEY_NOT_WORKSPACE_VISIBLE_MESSAGE)
    );
    const response = await put({ config: { data: [slackMapping] } });
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.code).toBe("survey_not_workspace_visible");
    expect(body.detail).toBe(SURVEY_NOT_WORKSPACE_VISIBLE_MESSAGE);
  });

  test("records the integration_connected event", async () => {
    await put({ config: { data: [slackMapping] } });

    expect(mocks.capturePostHogEvent).toHaveBeenCalledWith(
      USER_ID,
      "integration_connected",
      { integration_type: "slack", organization_id: ORG_ID, workspace_id: WORKSPACE_ID },
      { organizationId: ORG_ID, workspaceId: WORKSPACE_ID }
    );
  });

  test("refuses a caller without write access to the workspace, and stores nothing", async () => {
    mocks.assertCan.mockRejectedValue(new AuthorizationError("Not authorized"));
    expect((await put({ config: { data: [] } })).status).toBe(403);
    expect(mocks.createOrUpdateIntegration).not.toHaveBeenCalled();
  });

  test("answers 400 naming the field for a mapping of the wrong shape", async () => {
    const response = await put({ config: { data: [{ ...slackMapping, channelId: 42 }] } });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.invalid_params.map((param: { name: string }) => param.name)).toContain(
      "config.data.0.channelId"
    );
    expect(mocks.createOrUpdateIntegration).not.toHaveBeenCalled();
  });

  test("bounds the invalid_params list however many mappings are wrong", async () => {
    const data = Array.from({ length: 500 }, () => ({ ...slackMapping, channelId: 42 }));
    const body = await (await put({ config: { data } })).json();

    expect(body.invalid_params.length).toBeLessThanOrEqual(V3_INVALID_PARAMS_MAX + 1);
    expect(mocks.createOrUpdateIntegration).not.toHaveBeenCalled();
  });

  test.each([
    ["an integration type it doesn't manage", () => put({ config: { data: [] } }, "n8n")],
    ["a body that isn't a configuration", () => put({ type: "slack", config: { data: [] } })],
  ])("answers 400 for %s", async (_label, call) => {
    expect((await call()).status).toBe(400);
    expect(mocks.createOrUpdateIntegration).not.toHaveBeenCalled();
  });

  test("refuses a cross-site request (CSRF)", async () => {
    const response = await put({ config: { data: [] } }, "slack", {
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
    expect(lastAudit()).toMatchObject({
      action: "deleted",
      targetType: "integration",
      status: "success",
      targetId: INTEGRATION_ID,
    });
  });

  test("answers 404 when the workspace has no such integration", async () => {
    mocks.getIntegrationByType.mockResolvedValue(null);
    expect((await remove()).status).toBe(404);
    expect(mocks.deleteIntegration).not.toHaveBeenCalled();
  });

  test("refuses a caller without write access, before looking anything up", async () => {
    mocks.assertCan.mockRejectedValue(new AuthorizationError("Not authorized"));
    expect((await remove()).status).toBe(403);
    expectWorkspaceWriteChecked();
    expect(mocks.getIntegrationByType).not.toHaveBeenCalled();
    expect(mocks.deleteIntegration).not.toHaveBeenCalled();
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

  test("refuses a caller without write access to the workspace, before reading the integration", async () => {
    mocks.assertCan.mockRejectedValue(new AuthorizationError("Not authorized"));
    expect((await connection()).status).toBe(403);
    expectWorkspaceWriteChecked();
    expect(mocks.getIntegrationByType).not.toHaveBeenCalled();
    expect(mocks.validateGoogleSheetsConnection).not.toHaveBeenCalled();
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

  test("refuses a caller without write access to the workspace, before reading the integration", async () => {
    mocks.assertCan.mockRejectedValue(new AuthorizationError("Not authorized"));
    expect((await spreadsheet()).status).toBe(403);
    expectWorkspaceWriteChecked();
    expect(mocks.getIntegrationByType).not.toHaveBeenCalled();
    expect(mocks.getSpreadsheetNameById).not.toHaveBeenCalled();
  });

  test("answers 404 for a spreadsheet Google doesn't know", async () => {
    mocks.getSpreadsheetNameById.mockRejectedValue(new ResourceNotFoundError("Spreadsheet", "sheet-1"));
    const response = await spreadsheet();

    expect(response.status).toBe(404);
    expect((await response.json()).details).toEqual({ resource_type: "Spreadsheet", resource_id: "sheet-1" });
  });

  test("answers 500, not 502, for an error of ours", async () => {
    mocks.getSpreadsheetNameById.mockRejectedValue(new TypeError("Cannot read properties of undefined"));
    expect((await spreadsheet()).status).toBe(500);
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

  test.each(["invalid_auth", "missing_scope", "token_expired", "token_revoked"])(
    "asks for a reconnect when Slack answers %s",
    async (code) => {
      mocks.getSlackChannels.mockRejectedValue(new SlackApiError(code));
      const response = await channels();

      expect(response.status).toBe(409);
      expect((await response.json()).details).toEqual({ reason: "reauthorization_required" });
    }
  );

  test.each(["ratelimited", "http_503", "network_error"])(
    "answers 502 for the Slack failure %s",
    async (code) => {
      mocks.getSlackChannels.mockRejectedValue(new SlackApiError(code));
      expect((await channels()).status).toBe(502);
    }
  );

  test("answers 500, not 502, for an error of ours", async () => {
    mocks.getSlackChannels.mockRejectedValue(new TypeError("Cannot read properties of undefined"));
    expect((await channels()).status).toBe(500);
  });

  test("refuses a caller without write access to the workspace", async () => {
    mocks.assertCan.mockRejectedValue(new AuthorizationError("Not authorized"));
    expect((await channels()).status).toBe(403);
    expectWorkspaceWriteChecked();
    expect(mocks.getSlackChannels).not.toHaveBeenCalled();
  });

  test("is only for Slack", async () => {
    expect((await channels("notion")).status).toBe(404);
  });
});
