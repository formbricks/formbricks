import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { GET } from "./route";

const mocks = vi.hoisted(() => ({
  can: vi.fn(),
  getSession: vi.fn(),
  isEnabled: vi.fn(),
  resolveScope: vi.fn(),
  confirmReadable: vi.fn(),
  getOrganizationId: vi.fn(),
  find: vi.fn(),
}));

vi.mock("@/lib/authorization", () => ({ can: mocks.can }));
vi.mock("@/modules/ee/license-check/lib/utils", () => ({ getIsDataRetentionEnabled: mocks.isEnabled }));
vi.mock("@/modules/ee/data-retention/lib/exemption-read-scope", () => ({
  resolveRetentionExemptionReadScope: mocks.resolveScope,
  confirmReadableRetentionExemptions: mocks.confirmReadable,
}));
vi.mock("@/modules/ee/data-retention/lib/exemptions-service", () => ({
  getRetentionExemptionOrganizationId: mocks.getOrganizationId,
  findRetentionExemption: mocks.find,
}));
vi.mock("@/modules/auth/lib/session", () => ({ getSession: mocks.getSession }));
vi.mock("@/app/api/v1/auth", () => ({ authenticateRequest: vi.fn() }));
vi.mock("@/modules/core/rate-limit/helpers", () => ({
  applyRateLimit: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@formbricks/logger", () => ({
  logger: { withContext: vi.fn(() => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn() })), error: vi.fn() },
}));
vi.mock("server-only", () => ({}));

const ORG_ID = "clorg11111111111111111111";
const USER_ID = "cluser1111111111111111111";
const EXEMPTION_ID = "clexmaaaaaaaaaaaaaaaaaaaa";
const MEMBER_SCOPE = { kind: "surveys", workspaceIds: [], actorContext: {} };

const get = (exemptionId = EXEMPTION_ID) =>
  GET(
    new NextRequest(`http://localhost/api/internal/retention-exemptions/${exemptionId}`, {
      headers: { "x-request-id": "req_1" },
    }),
    { params: Promise.resolve({ exemptionId }) } as never
  );

const snapshot = async (response: Response) => ({
  status: response.status,
  headers: Object.fromEntries([...response.headers.entries()].sort()),
  body: await response.text(),
});

describe("GET /api/internal/retention-exemptions/{exemptionId}", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSession.mockResolvedValue({ user: { id: USER_ID } });
    mocks.can.mockResolvedValue(true);
    mocks.isEnabled.mockResolvedValue(true);
    mocks.resolveScope.mockResolvedValue(MEMBER_SCOPE);
    mocks.confirmReadable.mockImplementation(
      async (_userId: string, _scope: unknown, rows: unknown[]) => rows
    );
    mocks.getOrganizationId.mockResolvedValue(ORG_ID);
    mocks.find.mockResolvedValue({
      id: EXEMPTION_ID,
      entity: "responses",
      until: new Date("2031-03-31T21:59:59.999Z"),
      reason: "Audit",
      createdAt: new Date("2030-01-02T00:00:00.000Z"),
      revokedAt: new Date("2030-02-01T00:00:00.000Z"),
      surveyId: "clsrv11111111111111111111",
      surveyName: "Site visit feedback",
      workspaceId: "clwsp11111111111111111111",
      createdById: null,
      createdByName: null,
    });
  });

  test("returns the exemption, revoked or not, to a reader of its organisation within their scope", async () => {
    const response = await get();

    expect(response.status).toBe(200);
    expect((await response.json()).data).toMatchObject({
      id: EXEMPTION_ID,
      policy: "responses",
      createdBy: null,
      revokedAt: "2030-02-01T00:00:00.000Z",
    });
    expect(mocks.can).toHaveBeenCalledWith(expect.anything(), "organization.read_access", {
      type: "organization",
      id: ORG_ID,
    });
    expect(mocks.find).toHaveBeenCalledWith({
      id: EXEMPTION_ID,
      organizationId: ORG_ID,
      scope: MEMBER_SCOPE,
    });
  });

  test("answers a missing exemption, a foreign one, one outside the reader's scope and one the graph denies alike", async () => {
    mocks.getOrganizationId.mockResolvedValueOnce(null);
    const missing = await snapshot(await get());

    mocks.can.mockResolvedValueOnce(false);
    const foreign = await snapshot(await get());

    mocks.find.mockResolvedValueOnce(null);
    const outOfScope = await snapshot(await get());

    mocks.confirmReadable.mockResolvedValueOnce([]);
    const denied = await snapshot(await get());

    expect(missing.status).toBe(403);
    expect(foreign).toStrictEqual(missing);
    expect(outOfScope).toStrictEqual(missing);
    expect(denied).toStrictEqual(missing);
  });

  test("returns 400 on an id that isn't one", async () => {
    expect((await get("not an id")).status).toBe(400);
    expect(mocks.getOrganizationId).not.toHaveBeenCalled();
  });
});
