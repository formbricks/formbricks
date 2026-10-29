import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { GET } from "./route";

const mocks = vi.hoisted(() => ({
  can: vi.fn(),
  getSession: vi.fn(),
  getOrganizationsByUserId: vi.fn(),
}));

vi.mock("@/lib/authorization", () => ({ can: mocks.can }));
vi.mock("@/app/(app)/workspaces/[workspaceId]/lib/organization", () => ({
  getOrganizationsByUserId: mocks.getOrganizationsByUserId,
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

const USER_ID = "cluser1111111111111111111";

const list = (query = "") =>
  GET(new NextRequest(`http://localhost/api/internal/organizations${query ? `?${query}` : ""}`), {
    params: Promise.resolve({}),
  } as never);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getSession.mockResolvedValue({ user: { id: USER_ID } });
  mocks.getOrganizationsByUserId.mockResolvedValue([
    { id: "clorg11111111111111111111", name: "Acme", billing: { stripeCustomerId: "cus_secret" } },
    { id: "clorg22222222222222222222", name: "Beta" },
  ]);
});

describe("GET /api/internal/organizations", () => {
  test("lists the caller's own organizations, as id and name only", async () => {
    const response = await list();

    expect(response.status).toBe(200);
    expect((await response.json()).data).toEqual([
      { id: "clorg11111111111111111111", name: "Acme" },
      { id: "clorg22222222222222222222", name: "Beta" },
    ]);
    expect(mocks.getOrganizationsByUserId).toHaveBeenCalledWith(USER_ID);
    // The list is the caller's own authorization lookup: no per-organization check is needed or made.
    expect(mocks.can).not.toHaveBeenCalled();
  });

  test("answers an empty list for a user in no organization", async () => {
    mocks.getOrganizationsByUserId.mockResolvedValue([]);
    expect((await (await list()).json()).data).toEqual([]);
  });

  test("answers 400 for any query parameter, so a caller can't believe it scoped the list", async () => {
    expect((await list("organizationId=clorg11111111111111111111")).status).toBe(400);
    expect(mocks.getOrganizationsByUserId).not.toHaveBeenCalled();
  });

  test("answers 401 without a session, and lists nothing", async () => {
    mocks.getSession.mockResolvedValue(null);

    expect((await list()).status).toBe(401);
    expect(mocks.getOrganizationsByUserId).not.toHaveBeenCalled();
  });
});
