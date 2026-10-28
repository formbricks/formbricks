import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { GET } from "./route";

// vitestSetup mocks `createHash`, which would give every cursor fingerprint the same value and let a
// cursor issued for one filter pass on another. The binding is what these tests are about.
vi.mock("node:crypto", async (importOriginal) => await importOriginal<typeof import("node:crypto")>());
vi.mock("crypto", async (importOriginal) => await importOriginal<typeof import("crypto")>());

const {
  mockCan,
  mockGetSession,
  mockAuthenticateRequest,
  mockIsEnabled,
  mockListRows,
  mockResolveWorkspace,
} = vi.hoisted(() => ({
  mockCan: vi.fn(),
  mockGetSession: vi.fn(),
  mockAuthenticateRequest: vi.fn(),
  mockIsEnabled: vi.fn(),
  mockListRows: vi.fn(),
  mockResolveWorkspace: vi.fn(),
}));

vi.mock("@/lib/authorization", () => ({ can: mockCan }));
vi.mock("@/modules/auth/lib/session", () => ({ getSession: mockGetSession }));
vi.mock("@/app/api/v1/auth", () => ({ authenticateRequest: mockAuthenticateRequest }));
vi.mock("@/modules/ee/license-check/lib/utils", () => ({ getIsAuditLogsEnabled: mockIsEnabled }));
vi.mock("./lib/repository", () => ({ listAuditEventRows: mockListRows }));
vi.mock("@/app/api/v3/lib/workspace-context", () => ({ resolveV3WorkspaceContext: mockResolveWorkspace }));
vi.mock("@/modules/core/rate-limit/helpers", () => ({
  applyRateLimit: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/modules/ee/audit-logs/lib/handler", () => ({
  queueAuditEvent: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/app/lib/api/with-api-logging", () => ({
  buildAuditLogBaseObject: vi.fn((action: string, targetType: string) => ({ action, targetType })),
}));
vi.mock("@formbricks/logger", () => ({
  logger: {
    withContext: vi.fn(() => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn() })),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

const ORG_ID = "clorg11111111111111111111";
const OTHER_ORG_ID = "clorg22222222222222222222";
const WORKSPACE_ID = "clwks11111111111111111111";
// Row ids are cuid2 in the database, and a cursor carrying anything else is rejected as malformed.
const EVENT_B = "cleventbbbbbbbbbbbbbbbbbb";
const EVENT_A = "cleventaaaaaaaaaaaaaaaaaa";

const row = (id: string, timestamp: string, overrides: Record<string, unknown> = {}) => ({
  id,
  timestamp: new Date(timestamp),
  actorId: "user_1",
  actorType: "user",
  action: "deleted",
  targetType: "survey",
  targetId: "survey_1",
  status: "success",
  eventId: null,
  apiUrl: "https://app.example.com/api/v3/surveys/survey_1",
  ...overrides,
});

const apiKeyAuth = (overrides: Record<string, unknown> = {}) => ({
  type: "apiKey",
  apiKeyId: "key_1",
  organizationId: ORG_ID,
  organizationAccess: {},
  workspacePermissions: [{ workspaceId: WORKSPACE_ID, workspaceName: "W", permission: "manage" }],
  ...overrides,
});

const get = (query: string, headers?: Record<string, string>) =>
  GET(new NextRequest(`http://localhost/api/v3/audit-events?${query}`, { headers }), {} as never);

const getAsApiKey = (query: string) => get(query, { "x-api-key": "fbk_test" });

beforeEach(() => {
  vi.clearAllMocks();
  mockGetSession.mockResolvedValue({ user: { id: "user_1" } });
  mockCan.mockResolvedValue(true);
  mockIsEnabled.mockResolvedValue(true);
  mockListRows.mockResolvedValue([row(EVENT_B, "2030-01-02T00:00:00Z")]);
  mockAuthenticateRequest.mockResolvedValue(apiKeyAuth());
  mockResolveWorkspace.mockResolvedValue({ workspaceId: WORKSPACE_ID, organizationId: ORG_ID });
});

describe("GET /api/v3/audit-events: authorization", () => {
  test("an organization owner or manager gets a page, summarised without the stored request details", async () => {
    const response = await get(`organizationId=${ORG_ID}`);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      data: [
        {
          id: EVENT_B,
          timestamp: "2030-01-02T00:00:00.000Z",
          actor: { id: "user_1", type: "user" },
          action: "deleted",
          target: { type: "survey", id: "survey_1" },
          status: "success",
          eventId: null,
          apiUrl: "https://app.example.com/api/v3/surveys/survey_1",
        },
      ],
      meta: { limit: 20, nextCursor: null },
    });
    expect(mockCan).toHaveBeenCalledWith({ type: "user", id: "user_1" }, "organization.manage", {
      type: "organization",
      id: ORG_ID,
    });
  });

  test("answers 401 without a credential", async () => {
    mockGetSession.mockResolvedValue(null);
    mockAuthenticateRequest.mockResolvedValue(null);

    expect((await get(`organizationId=${ORG_ID}`)).status).toBe(401);
    expect(mockListRows).not.toHaveBeenCalled();
  });

  test("answers 403 to a member, and never reads", async () => {
    mockCan.mockResolvedValue(false);

    expect((await get(`organizationId=${ORG_ID}`)).status).toBe(403);
    expect(mockListRows).not.toHaveBeenCalled();
  });

  test("answers 403 for an organization the caller is not in, the same as for a missing one", async () => {
    mockCan.mockResolvedValue(false);

    const response = await get(`organizationId=${OTHER_ORG_ID}`);

    expect(response.status).toBe(403);
    expect(mockCan).toHaveBeenCalledWith(expect.anything(), "organization.manage", {
      type: "organization",
      id: OTHER_ORG_ID,
    });
    expect(mockListRows).not.toHaveBeenCalled();
  });

  test("answers 403 when audit logging is not enabled, but only to a caller who is authorized", async () => {
    mockIsEnabled.mockResolvedValue(false);
    const refused = await get(`organizationId=${ORG_ID}`);
    expect(refused.status).toBe(403);
    expect((await refused.json()).detail).toMatch(/not enabled/);
    expect(mockListRows).not.toHaveBeenCalled();

    mockIsEnabled.mockClear();
    mockCan.mockResolvedValue(false);
    await get(`organizationId=${ORG_ID}`);
    expect(mockIsEnabled).not.toHaveBeenCalled();
  });

  test("requires the organization to be named", async () => {
    expect((await get("")).status).toBe(400);
    expect(mockListRows).not.toHaveBeenCalled();
  });

  describe("API key", () => {
    test("with manage on a workspace of the organization reads it", async () => {
      const response = await getAsApiKey(`organizationId=${ORG_ID}`);

      expect(response.status).toBe(200);
      expect(mockCan).toHaveBeenCalledWith({ type: "apiKey", id: "key_1" }, "workspace.manage", {
        type: "workspace",
        id: WORKSPACE_ID,
      });
      expect(mockListRows).toHaveBeenCalledWith(expect.objectContaining({ organizationId: ORG_ID }));
    });

    test("is refused for any other organization than its own, without a lookup", async () => {
      const response = await getAsApiKey(`organizationId=${OTHER_ORG_ID}`);

      expect(response.status).toBe(403);
      expect(mockCan).not.toHaveBeenCalled();
      expect(mockListRows).not.toHaveBeenCalled();
    });

    test.each(["read", "write"])("is refused with only %s access", async (permission) => {
      mockAuthenticateRequest.mockResolvedValue(
        apiKeyAuth({ workspacePermissions: [{ workspaceId: WORKSPACE_ID, workspaceName: "W", permission }] })
      );

      expect((await getAsApiKey(`organizationId=${ORG_ID}`)).status).toBe(403);
      expect(mockListRows).not.toHaveBeenCalled();
    });

    test("is refused when the live authorization graph no longer grants manage", async () => {
      mockCan.mockResolvedValue(false);

      expect((await getAsApiKey(`organizationId=${ORG_ID}`)).status).toBe(403);
      expect(mockListRows).not.toHaveBeenCalled();
    });

    test("is refused when its workspace turns out to belong to another organization", async () => {
      mockResolveWorkspace.mockResolvedValue({ workspaceId: WORKSPACE_ID, organizationId: OTHER_ORG_ID });

      expect((await getAsApiKey(`organizationId=${ORG_ID}`)).status).toBe(403);
      expect(mockListRows).not.toHaveBeenCalled();
    });
  });
});

describe("GET /api/v3/audit-events: pagination", () => {
  test("defaults to 20 and reads one extra row to know whether another page exists", async () => {
    await get(`organizationId=${ORG_ID}`);

    expect(mockListRows).toHaveBeenCalledWith({
      organizationId: ORG_ID,
      query: expect.objectContaining({ limit: 20, cursor: null }),
    });
  });

  test.each(["0", "101", "-1", "1.5", "abc"])("rejects limit=%s with 400", async (limit) => {
    expect((await get(`organizationId=${ORG_ID}&limit=${limit}`)).status).toBe(400);
    expect(mockListRows).not.toHaveBeenCalled();
  });

  test("accepts the maximum of 100", async () => {
    const response = await get(`organizationId=${ORG_ID}&limit=100`);

    expect(response.status).toBe(200);
    expect((await response.json()).meta.limit).toBe(100);
  });

  test.each(["offset=5", "skip=5", "page=2", "sort=timestamp"])(
    "has no offset-style or unknown parameter: %s is a 400",
    async (param) => {
      expect((await get(`organizationId=${ORG_ID}&${param}`)).status).toBe(400);
      expect(mockListRows).not.toHaveBeenCalled();
    }
  );

  test("hands out a cursor only when a further row exists, and resumes strictly after the last row served", async () => {
    mockListRows.mockResolvedValue([
      row(EVENT_B, "2030-01-02T00:00:00Z"),
      row(EVENT_A, "2030-01-01T00:00:00Z"),
    ]);
    const first = await (await get(`organizationId=${ORG_ID}&limit=1`)).json();

    expect(first.data).toHaveLength(1);
    expect(first.meta.nextCursor).toEqual(expect.any(String));

    mockListRows.mockResolvedValue([row(EVENT_A, "2030-01-01T00:00:00Z")]);
    const second = await get(`organizationId=${ORG_ID}&limit=1&cursor=${first.meta.nextCursor}`);

    expect(second.status).toBe(200);
    expect((await second.json()).meta.nextCursor).toBeNull();
    expect(mockListRows).toHaveBeenLastCalledWith({
      organizationId: ORG_ID,
      query: expect.objectContaining({
        cursor: expect.objectContaining({ id: EVENT_B, value: "2030-01-02T00:00:00.000Z" }),
      }),
    });
  });

  test("a cursor stays valid when only the page size changes", async () => {
    mockListRows.mockResolvedValue([
      row(EVENT_B, "2030-01-02T00:00:00Z"),
      row(EVENT_A, "2030-01-01T00:00:00Z"),
    ]);
    const first = await (await get(`organizationId=${ORG_ID}&limit=1`)).json();

    expect((await get(`organizationId=${ORG_ID}&limit=50&cursor=${first.meta.nextCursor}`)).status).toBe(200);
  });

  test("rejects a cursor when a filter changes mid-walk", async () => {
    mockListRows.mockResolvedValue([
      row(EVENT_B, "2030-01-02T00:00:00Z"),
      row(EVENT_A, "2030-01-01T00:00:00Z"),
    ]);
    const first = await (await get(`organizationId=${ORG_ID}&limit=1&status=failure`)).json();

    const changed = await get(
      `organizationId=${ORG_ID}&limit=1&status=success&cursor=${first.meta.nextCursor}`
    );

    expect(changed.status).toBe(400);
    expect((await changed.json()).invalid_params).toEqual([expect.objectContaining({ name: "cursor" })]);
  });

  test("rejects a cursor issued for another organization", async () => {
    mockListRows.mockResolvedValue([
      row(EVENT_B, "2030-01-02T00:00:00Z"),
      row(EVENT_A, "2030-01-01T00:00:00Z"),
    ]);
    const first = await (await get(`organizationId=${ORG_ID}&limit=1`)).json();

    const other = await get(`organizationId=${OTHER_ORG_ID}&limit=1&cursor=${first.meta.nextCursor}`);

    expect(other.status).toBe(400);
  });

  test("rejects a malformed cursor", async () => {
    const response = await get(`organizationId=${ORG_ID}&cursor=not-a-cursor`);

    expect(response.status).toBe(400);
    expect(mockListRows).not.toHaveBeenCalled();
  });
});

describe("GET /api/v3/audit-events: filters", () => {
  test("passes every filter to the query, with the time range as instants", async () => {
    await get(
      `organizationId=${ORG_ID}&actorId=user_9&actorType=api&action=deleted&targetType=survey` +
        `&targetId=survey_9&status=failure&from=2030-01-01T00:00:00Z&to=2030-02-01T01:00:00%2B01:00`
    );

    expect(mockListRows).toHaveBeenCalledWith({
      organizationId: ORG_ID,
      query: expect.objectContaining({
        actorId: "user_9",
        actorType: "api",
        action: "deleted",
        targetType: "survey",
        targetId: "survey_9",
        status: "failure",
        from: new Date("2030-01-01T00:00:00Z"),
        to: new Date("2030-02-01T00:00:00Z"),
      }),
    });
  });

  test.each([
    ["an unknown action", "action=exploded"],
    ["an unknown target type", "targetType=spaceship"],
    ["an unknown actor type", "actorType=robot"],
    ["an unknown status", "status=maybe"],
    ["a targetId without its targetType", "targetId=survey_9"],
    ["a time range that is not ordered", "from=2030-02-01T00:00:00Z&to=2030-01-01T00:00:00Z"],
    ["an empty range", "from=2030-01-01T00:00:00Z&to=2030-01-01T00:00:00Z"],
    ["a date that is not a timestamp", "from=yesterday"],
    ["an over-long id filter", `actorId=${"x".repeat(256)}`],
  ])("rejects %s with 400", async (_label, query) => {
    const response = await get(`organizationId=${ORG_ID}&${query}`);

    expect(response.status).toBe(400);
    expect(mockListRows).not.toHaveBeenCalled();
  });
});
