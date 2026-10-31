import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { GET } from "./route";

const mocks = vi.hoisted(() => ({ getSession: vi.fn(), getLatestStableFbRelease: vi.fn() }));

vi.mock("@/modules/workspaces/settings/(setup)/app-connection/lib/github", () => ({
  getLatestStableFbRelease: mocks.getLatestStableFbRelease,
}));
vi.mock("@/modules/auth/lib/session", () => ({ getSession: mocks.getSession }));
vi.mock("@/app/api/v1/auth", () => ({ authenticateRequest: vi.fn() }));
vi.mock("@/modules/core/rate-limit/helpers", () => ({
  applyRateLimit: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@formbricks/logger", () => ({
  logger: { withContext: vi.fn(() => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn() })), error: vi.fn() },
}));

const latest = () =>
  GET(new NextRequest("http://localhost/api/internal/releases/latest"), {
    params: Promise.resolve({}),
  } as never);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getSession.mockResolvedValue({ user: { id: "cluser1111111111111111111" } });
});

describe("GET /api/internal/releases/latest", () => {
  test("answers the latest stable release tag", async () => {
    mocks.getLatestStableFbRelease.mockResolvedValue("v6.1.0");
    const response = await latest();

    expect(response.status).toBe(200);
    expect((await response.json()).data).toEqual({ tag: "v6.1.0" });
  });

  test("answers null when GitHub couldn't say", async () => {
    mocks.getLatestStableFbRelease.mockResolvedValue(null);
    expect((await (await latest()).json()).data).toEqual({ tag: null });
  });

  test("is for signed-in users only: it calls out to GitHub", async () => {
    mocks.getSession.mockResolvedValue(null);
    expect((await latest()).status).toBe(401);
    expect(mocks.getLatestStableFbRelease).not.toHaveBeenCalled();
  });
});
