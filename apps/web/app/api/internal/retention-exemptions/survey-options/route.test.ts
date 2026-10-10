import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { GET } from "./route";

const mocks = vi.hoisted(() => ({
  can: vi.fn(),
  getSession: vi.fn(),
  isEnabled: vi.fn(),
  search: vi.fn(),
}));

vi.mock("@/lib/authorization", () => ({ can: mocks.can }));
vi.mock("@/modules/ee/license-check/lib/utils", () => ({ getIsDataRetentionEnabled: mocks.isEnabled }));
vi.mock("@/modules/ee/data-retention/lib/exemptions-service", () => ({
  searchRetentionExemptionSurveys: mocks.search,
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
const OPTION = { id: "clsrv11111111111111111111", name: "Site visit feedback", workspaceName: "Europe" };

const get = (query: string) =>
  GET(
    new NextRequest(`http://localhost/api/internal/retention-exemptions/survey-options?${query}`),
    {} as never
  );

describe("GET /api/internal/retention-exemptions/survey-options", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSession.mockResolvedValue({ user: { id: "cluser1111111111111111111" } });
    mocks.can.mockResolvedValue(true);
    mocks.isEnabled.mockResolvedValue(true);
    mocks.search.mockResolvedValue([OPTION]);
  });

  test("searches the organisation's surveys for an owner or manager", async () => {
    const response = await get(`organizationId=${ORG_ID}&search=%20site%20`);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: [OPTION] });
    expect(mocks.can).toHaveBeenCalledWith(expect.anything(), "organization.manage", {
      type: "organization",
      id: ORG_ID,
    });
    expect(mocks.search).toHaveBeenCalledWith({ organizationId: ORG_ID, search: "site", limit: 20 });
  });

  test("returns 403 to a member, who can't create exemptions", async () => {
    mocks.can.mockResolvedValueOnce(false);

    expect((await get(`organizationId=${ORG_ID}`)).status).toBe(403);
    expect(mocks.search).not.toHaveBeenCalled();
  });

  test.each([["limit=51"], ["search=" + "x".repeat(201)], ["workspaceId=clwsp11111111111111111111"]])(
    "returns 400 on %s",
    async (query) => {
      expect((await get(`organizationId=${ORG_ID}&${query}`)).status).toBe(400);
    }
  );
});
