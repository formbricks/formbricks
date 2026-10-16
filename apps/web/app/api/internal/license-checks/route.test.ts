import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { SAME_ORIGIN_HEADERS } from "@/app/api/v3/lib/test-utils";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import { POST } from "./route";

const mocks = vi.hoisted(() => ({
  constants: { IS_FORMBRICKS_CLOUD: false },
  can: vi.fn(),
  getSession: vi.fn(),
  getOrganizationIdFromWorkspaceId: vi.fn(),
  applyRateLimit: vi.fn(),
  clearLicenseCache: vi.fn(),
  fetchLicenseFresh: vi.fn(),
  computeFreshLicenseState: vi.fn(),
  cacheSet: vi.fn(),
}));

vi.mock("@/lib/constants", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/constants")>()),
  get IS_FORMBRICKS_CLOUD() {
    return mocks.constants.IS_FORMBRICKS_CLOUD;
  },
}));
vi.mock("@/lib/authorization", () => ({ can: mocks.can }));
vi.mock("@/lib/utils/helper", () => ({
  getOrganizationIdFromWorkspaceId: mocks.getOrganizationIdFromWorkspaceId,
}));
vi.mock("@/lib/cache", () => ({ cache: { set: mocks.cacheSet } }));
vi.mock("@/modules/ee/license-check/lib/license", async () => {
  class LicenseApiError extends Error {
    constructor(
      message: string,
      public readonly status: number
    ) {
      super(message);
    }
  }
  return {
    FAILED_FETCH_TTL_MS: 1,
    FETCH_LICENSE_TTL_MS: 2,
    LicenseApiError,
    clearLicenseCache: mocks.clearLicenseCache,
    computeFreshLicenseState: mocks.computeFreshLicenseState,
    fetchLicenseFresh: mocks.fetchLicenseFresh,
    getCacheKeys: () => ({ FETCH_LICENSE_CACHE_KEY: "license-key" }),
  };
});
vi.mock("@/modules/auth/lib/session", () => ({ getSession: mocks.getSession }));
vi.mock("@/app/api/v1/auth", () => ({ authenticateRequest: vi.fn() }));
vi.mock("@/modules/core/rate-limit/helpers", () => ({ applyRateLimit: mocks.applyRateLimit }));
vi.mock("@formbricks/logger", () => ({
  logger: { withContext: vi.fn(() => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn() })), error: vi.fn() },
}));
vi.mock("server-only", () => ({}));

const { LicenseApiError } = await import("@/modules/ee/license-check/lib/license");

const USER_ID = "cluser1111111111111111111";
const ORG_ID = "clorg11111111111111111111";
const WORKSPACE_ID = "clwork1111111111111111111";

const recheck = () =>
  POST(
    new NextRequest(`http://localhost/api/internal/license-checks?workspaceId=${WORKSPACE_ID}`, {
      method: "POST",
      headers: SAME_ORIGIN_HEADERS,
    }),
    { params: Promise.resolve({}) } as never
  );

beforeEach(() => {
  vi.clearAllMocks();
  mocks.constants.IS_FORMBRICKS_CLOUD = false;
  mocks.getSession.mockResolvedValue({ user: { id: USER_ID } });
  mocks.can.mockResolvedValue(true);
  mocks.getOrganizationIdFromWorkspaceId.mockResolvedValue(ORG_ID);
  mocks.applyRateLimit.mockResolvedValue(undefined);
  mocks.fetchLicenseFresh.mockResolvedValue({ status: "active" });
  mocks.computeFreshLicenseState.mockResolvedValue({ active: true, status: "active" });
});

describe("POST /api/internal/license-checks", () => {
  test("fetches the license fresh for an owner or manager, caches it and answers its state", async () => {
    const response = await recheck();

    expect(response.status).toBe(200);
    expect((await response.json()).data).toEqual({ active: true, status: "active" });
    expect(mocks.applyRateLimit).toHaveBeenCalledWith(rateLimitConfigs.actions.licenseRecheck, USER_ID);
    expect(mocks.can).toHaveBeenCalledWith({ type: "user", id: USER_ID }, "organization.manage", {
      type: "organization",
      id: ORG_ID,
    });
    expect(mocks.clearLicenseCache).toHaveBeenCalled();
    expect(mocks.cacheSet).toHaveBeenCalledWith("license-key", { value: { status: "active" } }, 2);
  });

  test("caches a failed fetch as null for the shorter window", async () => {
    mocks.fetchLicenseFresh.mockResolvedValue(null);
    mocks.computeFreshLicenseState.mockResolvedValue({ active: false, status: "unreachable" });
    const response = await recheck();

    expect((await response.json()).data).toEqual({ active: false, status: "unreachable" });
    expect(mocks.cacheSet).toHaveBeenCalledWith("license-key", { value: null }, 1);
  });

  test.each([
    [400, "invalid_license"],
    [403, "instance_mismatch"],
  ])("answers a license server %i as status %s, not as a failure", async (status, expected) => {
    mocks.fetchLicenseFresh.mockRejectedValue(new LicenseApiError("refused", status));
    const response = await recheck();

    expect(response.status).toBe(200);
    expect((await response.json()).data).toEqual({ active: false, status: expected });
  });

  test.each([
    ["a member who can't manage the organization", (action: string) => action === "organization.read"],
    ["someone outside the organization", () => false],
  ])("refuses %s with the same 403, and checks nothing", async (_label, allow) => {
    mocks.can.mockImplementation(async (_actor: unknown, action: string) => allow(action));
    const response = await recheck();

    expect(response.status).toBe(403);
    expect((await response.json()).detail).toBe("Only owners and managers can recheck the license");
    expect(mocks.fetchLicenseFresh).not.toHaveBeenCalled();
  });

  test("is refused on Formbricks Cloud", async () => {
    mocks.constants.IS_FORMBRICKS_CLOUD = true;
    expect((await recheck()).status).toBe(403);
    expect(mocks.fetchLicenseFresh).not.toHaveBeenCalled();
  });
});
