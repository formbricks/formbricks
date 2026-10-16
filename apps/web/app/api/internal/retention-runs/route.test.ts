import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { GET } from "./route";

// vitestSetup mocks `createHash`, which would give every cursor fingerprint the same value and let a
// cursor issued for one filter pass on another. The binding is what these tests are about.
vi.mock("node:crypto", async (importOriginal) => await importOriginal<typeof import("node:crypto")>());
vi.mock("crypto", async (importOriginal) => await importOriginal<typeof import("crypto")>());

const { mockCan, mockGetSession, mockIsEnabled, mockListPage } = vi.hoisted(() => ({
  mockCan: vi.fn(),
  mockGetSession: vi.fn(),
  mockIsEnabled: vi.fn(),
  mockListPage: vi.fn(),
}));

vi.mock("@/lib/authorization", () => ({ can: mockCan }));
vi.mock("@/modules/ee/license-check/lib/utils", () => ({ getIsDataRetentionEnabled: mockIsEnabled }));
vi.mock("@/modules/ee/data-retention/lib/runs-service", () => ({
  listRetentionRunKeysetPage: mockListPage,
}));
vi.mock("@/modules/auth/lib/session", () => ({ getSession: mockGetSession }));
vi.mock("@/app/api/v1/auth", () => ({ authenticateRequest: vi.fn() }));
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
  logger: { withContext: vi.fn(() => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn() })), error: vi.fn() },
}));

const ORG_ID = "clorg11111111111111111111";
// Run ids are cuid2 in the database, and a cursor carrying anything else is rejected as malformed.
const RUN_B = "clrunbbbbbbbbbbbbbbbbbbbb";
const RUN_A = "clrunaaaaaaaaaaaaaaaaaaaa";
const run = (id: string, startedAt: string) => ({
  id,
  entity: "surveys",
  startedAt: new Date(startedAt),
  finishedAt: new Date(startedAt),
  notifiedCount: 1,
  archivedCount: 2,
  deletedCount: 0,
  skippedCount: 0,
  hasChanges: true,
});

const get = (query: string) =>
  GET(new NextRequest(`http://localhost/api/internal/retention-runs?${query}`), {} as never);

describe("GET /api/internal/retention-runs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue({ user: { id: "user_1" } });
    mockCan.mockResolvedValue(true);
    mockIsEnabled.mockResolvedValue(true);
    mockListPage.mockResolvedValue([run(RUN_B, "2030-01-02T00:00:00Z")]);
  });

  test("returns a page of History for an owner or manager, empty runs hidden by default", async () => {
    const response = await get(`organizationId=${ORG_ID}`);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      data: [
        {
          id: RUN_B,
          policy: "surveys",
          startedAt: "2030-01-02T00:00:00.000Z",
          finishedAt: "2030-01-02T00:00:00.000Z",
          notified: 1,
          archived: 2,
          deleted: 0,
          skipped: 0,
        },
      ],
      meta: { limit: 25, nextCursor: null },
    });
    expect(mockCan).toHaveBeenCalledWith(expect.anything(), "organization.manage", {
      type: "organization",
      id: ORG_ID,
    });
    expect(mockListPage).toHaveBeenCalledWith({
      organizationId: ORG_ID,
      includeEmpty: false,
      limit: 25,
      cursor: null,
    });
  });

  test("returns 401 without a session", async () => {
    mockGetSession.mockResolvedValue(null);

    expect((await get(`organizationId=${ORG_ID}`)).status).toBe(401);
    expect(mockListPage).not.toHaveBeenCalled();
  });

  test("returns 403 to a member, since History names people", async () => {
    mockCan.mockResolvedValue(false);

    expect((await get(`organizationId=${ORG_ID}`)).status).toBe(403);
    expect(mockListPage).not.toHaveBeenCalled();
  });

  test("returns 403 when the organization isn't entitled to data retention", async () => {
    mockIsEnabled.mockResolvedValue(false);

    expect((await get(`organizationId=${ORG_ID}`)).status).toBe(403);
    expect(mockListPage).not.toHaveBeenCalled();
  });

  test("returns 400 on an unknown query parameter", async () => {
    const response = await get(`organizationId=${ORG_ID}&sort=asc`);

    expect(response.status).toBe(400);
    expect(mockListPage).not.toHaveBeenCalled();
  });

  test("returns 400 on cursor when includeEmpty changes mid-walk", async () => {
    mockListPage.mockResolvedValue([run(RUN_B, "2030-01-02T00:00:00Z"), run(RUN_A, "2030-01-01T00:00:00Z")]);
    const first = await (await get(`organizationId=${ORG_ID}&limit=1`)).json();
    expect(first.meta.nextCursor).toEqual(expect.any(String));

    const sameFilter = await get(`organizationId=${ORG_ID}&limit=1&cursor=${first.meta.nextCursor}`);
    expect(sameFilter.status).toBe(200);
    expect(mockListPage).toHaveBeenLastCalledWith(
      expect.objectContaining({ cursor: expect.objectContaining({ id: RUN_B }) })
    );

    const changed = await get(
      `organizationId=${ORG_ID}&limit=1&includeEmpty=true&cursor=${first.meta.nextCursor}`
    );
    expect(changed.status).toBe(400);
    expect((await changed.json()).invalid_params).toEqual([expect.objectContaining({ name: "cursor" })]);
  });

  test("returns 400 on cursor when it was issued for another organization", async () => {
    mockListPage.mockResolvedValue([run(RUN_B, "2030-01-02T00:00:00Z"), run(RUN_A, "2030-01-01T00:00:00Z")]);
    const first = await (await get(`organizationId=${ORG_ID}&limit=1`)).json();

    const other = await get(
      `organizationId=clorg22222222222222222222&limit=1&cursor=${first.meta.nextCursor}`
    );

    expect(other.status).toBe(400);
  });
});
