import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { GET } from "./route";

const mocks = vi.hoisted(() => ({
  can: vi.fn(),
  getSession: vi.fn(),
  getTeamsByOrganizationId: vi.fn(),
}));

vi.mock("@/lib/authorization", () => ({ can: mocks.can }));
vi.mock("@/modules/ee/teams/team-list/lib/team", () => ({
  getTeamsByOrganizationId: mocks.getTeamsByOrganizationId,
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

const list = (query = `organizationId=${ORG_ID}`) =>
  GET(new NextRequest(`http://localhost/api/internal/teams?${query}`), {
    params: Promise.resolve({}),
  } as never);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getSession.mockResolvedValue({ user: { id: USER_ID } });
  mocks.can.mockImplementation(async (_actor: unknown, action: string) => action === "organization.manage");
  mocks.getTeamsByOrganizationId.mockResolvedValue([
    { id: "clteam1111111111111111111", name: "Product", memberCount: 4 },
  ]);
});

describe("GET /api/internal/teams", () => {
  test("lists the organization's teams for an owner or manager, as id and name only", async () => {
    const response = await list();

    expect(response.status).toBe(200);
    expect((await response.json()).data).toEqual([{ id: "clteam1111111111111111111", name: "Product" }]);
    expect(mocks.can).toHaveBeenCalledWith({ type: "user", id: USER_ID }, "organization.manage", {
      type: "organization",
      id: ORG_ID,
    });
    expect(mocks.getTeamsByOrganizationId).toHaveBeenCalledWith(ORG_ID);
  });

  test("answers an empty list when the organization has no teams", async () => {
    mocks.getTeamsByOrganizationId.mockResolvedValue(null);
    expect((await (await list()).json()).data).toEqual([]);
  });

  test("refuses a member without organization.manage with 403, and lists nothing", async () => {
    mocks.can.mockResolvedValue(false);

    expect((await list()).status).toBe(403);
    expect(mocks.getTeamsByOrganizationId).not.toHaveBeenCalled();
  });

  test.each([
    ["no organization", ""],
    ["a malformed organization id", "organizationId=not-a-cuid"],
    ["an unknown parameter", `organizationId=${ORG_ID}&teamId=x`],
  ])("answers 400 for %s", async (_label, query) => {
    expect((await list(query)).status).toBe(400);
    expect(mocks.getTeamsByOrganizationId).not.toHaveBeenCalled();
  });

  test("answers 401 without a session", async () => {
    mocks.getSession.mockResolvedValue(null);
    expect((await list()).status).toBe(401);
  });
});
