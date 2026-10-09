import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { GET, POST } from "./route";

// vitestSetup mocks `createHash`, which would give every cursor fingerprint the same value and let a
// cursor issued for one organisation pass on another. The binding is what one of these tests is about.
vi.mock("node:crypto", async (importOriginal) => await importOriginal<typeof import("node:crypto")>());
vi.mock("crypto", async (importOriginal) => await importOriginal<typeof import("crypto")>());

const mocks = vi.hoisted(() => ({
  can: vi.fn(),
  getSession: vi.fn(),
  isEnabled: vi.fn(),
  resolveScope: vi.fn(),
  confirmReadable: vi.fn(),
  listPage: vi.fn(),
  find: vi.fn(),
  getSurvey: vi.fn(),
  create: vi.fn(),
  queueAuditEvent: vi.fn(),
  readClock: vi.fn(async () => new Date()),
}));

vi.mock("@/lib/authorization", () => ({ can: mocks.can }));
// The database clock, read where the app clock would be: fake timers pin both.
vi.mock("@/lib/utils/database-clock", () => ({
  readDatabaseClock: mocks.readClock,
}));
vi.mock("@/modules/ee/license-check/lib/utils", () => ({ getIsDataRetentionEnabled: mocks.isEnabled }));
vi.mock("@/modules/ee/data-retention/lib/exemption-read-scope", () => ({
  resolveRetentionExemptionReadScope: mocks.resolveScope,
  confirmReadableRetentionExemptions: mocks.confirmReadable,
}));
vi.mock("@/modules/ee/data-retention/lib/exemptions-service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/modules/ee/data-retention/lib/exemptions-service")>();
  return {
    RetentionExemptionExistsError: actual.RetentionExemptionExistsError,
    listRetentionExemptionKeysetPage: mocks.listPage,
    findRetentionExemption: mocks.find,
    getRetentionExemptionSurvey: mocks.getSurvey,
    createRetentionExemption: mocks.create,
  };
});
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

const ORG_ID = "clorg11111111111111111111";
const OTHER_ORG_ID = "clorg22222222222222222222";
const USER_ID = "cluser1111111111111111111";
const SURVEY_ID = "clsrv11111111111111111111";
const EXEMPTION_B = "clexmbbbbbbbbbbbbbbbbbbbb";
const EXEMPTION_A = "clexmaaaaaaaaaaaaaaaaaaaa";
const SCOPE = { kind: "organization" };

const row = (id: string, createdAt = "2030-01-02T00:00:00.000Z") => ({
  id,
  entity: "surveys",
  until: new Date("2031-03-31T21:59:59.999Z"),
  reason: "Supplier audit",
  createdAt: new Date(createdAt),
  revokedAt: null,
  surveyId: SURVEY_ID,
  surveyName: "Site visit feedback",
  workspaceId: "clwsp11111111111111111111",
  createdById: USER_ID,
  createdByName: "Anna Keller",
});

const serialized = (id: string) => ({
  id,
  surveyId: SURVEY_ID,
  surveyName: "Site visit feedback",
  workspaceId: "clwsp11111111111111111111",
  policy: "surveys",
  until: "2031-03-31T21:59:59.999Z",
  reason: "Supplier audit",
  createdBy: { id: USER_ID, name: "Anna Keller" },
  createdAt: "2030-01-02T00:00:00.000Z",
  revokedAt: null,
});

const get = (query: string) =>
  GET(new NextRequest(`http://localhost/api/internal/retention-exemptions?${query}`), {} as never);

const post = (body: unknown) =>
  POST(
    new NextRequest("http://localhost/api/internal/retention-exemptions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-request-id": "req_1" },
      body: JSON.stringify(body),
    }),
    {} as never
  );

/** Status, headers and body, so two refusals can be compared byte for byte. */
const snapshot = async (response: Response) => ({
  status: response.status,
  headers: Object.fromEntries([...response.headers.entries()].sort()),
  body: await response.text(),
});

describe("GET /api/internal/retention-exemptions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSession.mockResolvedValue({ user: { id: USER_ID } });
    mocks.can.mockResolvedValue(true);
    mocks.isEnabled.mockResolvedValue(true);
    mocks.resolveScope.mockResolvedValue(SCOPE);
    mocks.confirmReadable.mockImplementation(
      async (_userId: string, _scope: unknown, rows: unknown[]) => rows
    );
    mocks.listPage.mockResolvedValue([row(EXEMPTION_B)]);
  });

  test("returns the active exemptions to anyone who can read the organisation, within their scope", async () => {
    // Active as of the database's clock, which exemptions are created and revoked on.
    const dbNow = new Date("2030-01-05T00:00:00.123Z");
    mocks.readClock.mockResolvedValueOnce(dbNow);

    const response = await get(`organizationId=${ORG_ID}`);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      data: [serialized(EXEMPTION_B)],
      meta: { limit: 25, nextCursor: null },
    });
    expect(mocks.can).toHaveBeenCalledWith(expect.anything(), "organization.read_access", {
      type: "organization",
      id: ORG_ID,
    });
    expect(mocks.resolveScope).toHaveBeenCalledWith(USER_ID, ORG_ID);
    expect(mocks.listPage).toHaveBeenCalledWith({
      organizationId: ORG_ID,
      scope: SCOPE,
      now: dbNow,
      limit: 25,
      cursor: null,
    });
  });

  test("returns a cursor on a full page, which only continues the same organisation's walk", async () => {
    mocks.listPage.mockResolvedValue([row(EXEMPTION_B, "2030-01-02T00:00:00Z"), row(EXEMPTION_A)]);

    const first = await (await get(`organizationId=${ORG_ID}&limit=1`)).json();
    expect(first.data).toHaveLength(1);
    expect(first.meta.nextCursor).toEqual(expect.any(String));

    const next = await get(`organizationId=${ORG_ID}&limit=1&cursor=${first.meta.nextCursor}`);
    expect(next.status).toBe(200);
    expect(mocks.listPage).toHaveBeenLastCalledWith(
      expect.objectContaining({ cursor: expect.objectContaining({ id: EXEMPTION_B }) })
    );

    const elsewhere = await get(`organizationId=${OTHER_ORG_ID}&limit=1&cursor=${first.meta.nextCursor}`);
    expect(elsewhere.status).toBe(400);
  });

  test("drops what the graph denies from the page, but keeps the cursor of the rows walked", async () => {
    mocks.listPage.mockResolvedValue([row(EXEMPTION_B), row(EXEMPTION_A), row(EXEMPTION_A)]);
    mocks.confirmReadable.mockResolvedValueOnce([]);

    const body = await (await get(`organizationId=${ORG_ID}&limit=2`)).json();

    expect(body.data).toEqual([]);
    expect(body.meta.nextCursor).toEqual(expect.any(String));
    expect(mocks.confirmReadable).toHaveBeenCalledWith(USER_ID, SCOPE, [
      expect.objectContaining({ id: EXEMPTION_B }),
      expect.objectContaining({ id: EXEMPTION_A }),
    ]);
  });

  test("returns 401 without a session", async () => {
    mocks.getSession.mockResolvedValue(null);

    expect((await get(`organizationId=${ORG_ID}`)).status).toBe(401);
    expect(mocks.listPage).not.toHaveBeenCalled();
  });

  test("returns 403 to someone without read access, and when the organization isn't entitled", async () => {
    mocks.can.mockResolvedValueOnce(false);
    expect((await get(`organizationId=${ORG_ID}`)).status).toBe(403);

    mocks.isEnabled.mockResolvedValueOnce(false);
    expect((await get(`organizationId=${ORG_ID}`)).status).toBe(403);

    expect(mocks.listPage).not.toHaveBeenCalled();
  });

  test("returns 400 on an unknown query parameter", async () => {
    expect((await get(`organizationId=${ORG_ID}&includeRevoked=true`)).status).toBe(400);
  });
});

describe("POST /api/internal/retention-exemptions", () => {
  const body = {
    surveyId: SURVEY_ID,
    policy: "surveys",
    until: "2031-03-31T21:59:59.999Z",
    reason: "  Supplier audit  ",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ now: new Date("2030-01-02T00:00:00.000Z"), toFake: ["Date"] });
    mocks.getSession.mockResolvedValue({ user: { id: USER_ID } });
    mocks.can.mockResolvedValue(true);
    mocks.isEnabled.mockResolvedValue(true);
    mocks.getSurvey.mockResolvedValue({ id: SURVEY_ID, name: "Site visit feedback", organizationId: ORG_ID });
    mocks.create.mockResolvedValue({ id: EXEMPTION_A });
    mocks.find.mockResolvedValue(row(EXEMPTION_A));
    mocks.queueAuditEvent.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("creates the exemption in the survey's organisation and audits it", async () => {
    const response = await post(body);

    expect(response.status).toBe(201);
    expect(response.headers.get("Location")).toBe(`/api/internal/retention-exemptions/${EXEMPTION_A}`);
    expect((await response.json()).data).toEqual(serialized(EXEMPTION_A));
    expect(mocks.can).toHaveBeenCalledWith(expect.anything(), "organization.manage", {
      type: "organization",
      id: ORG_ID,
    });
    expect(mocks.create).toHaveBeenCalledWith({
      organizationId: ORG_ID,
      surveyId: SURVEY_ID,
      entity: "surveys",
      until: new Date(body.until),
      reason: "Supplier audit",
      createdById: USER_ID,
      now: new Date("2030-01-02T00:00:00.000Z"),
    });
    expect(mocks.queueAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "created",
        targetType: "retentionExemption",
        targetId: EXEMPTION_A,
        organizationId: ORG_ID,
        status: "success",
        newObject: {
          surveyId: SURVEY_ID,
          policy: "surveys",
          until: "2031-03-31T21:59:59.999Z",
          reason: "Supplier audit",
        },
      })
    );
  });

  test("answers a missing survey exactly like one the caller can't manage", async () => {
    mocks.getSurvey.mockResolvedValueOnce(null);
    const missing = await snapshot(await post(body));

    mocks.getSurvey.mockResolvedValueOnce({ id: SURVEY_ID, name: "Theirs", organizationId: OTHER_ORG_ID });
    mocks.can.mockResolvedValueOnce(false);
    const foreign = await snapshot(await post(body));

    expect(missing.status).toBe(403);
    expect(foreign).toStrictEqual(missing);
    expect(mocks.create).not.toHaveBeenCalled();
  });

  test("returns 403 to a member, and when the organization isn't entitled", async () => {
    mocks.can.mockResolvedValueOnce(false);
    expect((await post(body)).status).toBe(403);
    // The refused attempt still says which survey it was for.
    expect(mocks.queueAuditEvent).toHaveBeenLastCalledWith(
      expect.objectContaining({
        action: "created",
        status: "failure",
        newObject: { surveyId: SURVEY_ID, policy: "surveys" },
      })
    );

    mocks.isEnabled.mockResolvedValueOnce(false);
    expect((await post(body)).status).toBe(403);

    expect(mocks.create).not.toHaveBeenCalled();
  });

  test.each([
    ["has already ended", "2030-01-01T00:00:00.000Z"],
    ["ends right now", "2030-01-02T00:00:00.000Z"],
    ["ends more than ten years out", "2040-01-02T00:00:00.001Z"],
  ])("returns 422 on an end date that %s", async (_case, until) => {
    const response = await post({ ...body, until });

    expect(response.status).toBe(422);
    expect((await response.json()).invalid_params).toEqual([{ name: "until", reason: expect.any(String) }]);
    expect(mocks.create).not.toHaveBeenCalled();
  });

  test("accepts an end date exactly ten years out", async () => {
    expect((await post({ ...body, until: "2040-01-02T00:00:00.000Z" })).status).toBe(201);
  });

  test.each([
    ["an unknown field", { ...body, organizationId: ORG_ID }],
    ["the members policy", { ...body, policy: "members" }],
    ["a blank reason", { ...body, reason: "   " }],
    ["a reason over 500 characters", { ...body, reason: "x".repeat(501) }],
    ["an end date without a time zone", { ...body, until: "2031-03-31T00:00:00" }],
  ])("returns 400 on %s", async (_case, invalid) => {
    expect((await post(invalid)).status).toBe(400);
    expect(mocks.getSurvey).not.toHaveBeenCalled();
  });

  test("returns 422 when the survey already has an active exemption for the policy", async () => {
    const { RetentionExemptionExistsError } =
      await import("@/modules/ee/data-retention/lib/exemptions-service");
    mocks.create.mockRejectedValueOnce(new RetentionExemptionExistsError());

    const response = await post(body);

    expect(response.status).toBe(422);
    expect((await response.json()).code).toBe("retention_exemption_exists");
    expect(mocks.queueAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: "created", organizationId: ORG_ID, status: "failure" })
    );
  });
});
