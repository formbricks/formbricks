import { beforeEach, describe, expect, test, vi } from "vitest";
import { RETENTION_NOT_ENABLED_DETAIL, requireRetentionOrgAccess } from "./api-access";

const { mockCan, mockGetIsDataRetentionEnabled } = vi.hoisted(() => ({
  mockCan: vi.fn(),
  mockGetIsDataRetentionEnabled: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/authorization", () => ({ can: mockCan }));
vi.mock("@/modules/ee/license-check/lib/utils", () => ({
  getIsDataRetentionEnabled: mockGetIsDataRetentionEnabled,
}));

const USER_ID = "user_1";
const session = { user: { id: USER_ID }, expires: "2099-01-01" } as never;
const check = (organizationId: string, authentication = session) =>
  requireRetentionOrgAccess({
    authentication,
    organizationId,
    action: "organization.manage",
    requestId: "req_1",
    instance: "/api/internal/retention-runs",
  });

describe("requireRetentionOrgAccess", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCan.mockResolvedValue(true);
    mockGetIsDataRetentionEnabled.mockResolvedValue(true);
  });

  test("lets an authorized, entitled caller through with the organization and user", async () => {
    await expect(check("org_1")).resolves.toEqual({ organizationId: "org_1", userId: USER_ID });
    expect(mockCan).toHaveBeenCalledWith({ type: "user", id: USER_ID }, "organization.manage", {
      type: "organization",
      id: "org_1",
    });
  });

  test("returns 401 without a session user, before any lookup", async () => {
    const response = await check("org_1", null as never);

    expect((response as Response).status).toBe(401);
    expect(mockCan).not.toHaveBeenCalled();
  });

  test("gives a missing organization and someone else's the same 403, byte for byte", async () => {
    mockCan.mockResolvedValue(false);

    const missing = (await check("org_missing")) as Response;
    const foreign = (await check("org_foreign")) as Response;

    expect(missing.status).toBe(403);
    expect(await missing.text()).toBe(await foreign.text());
    expect([...missing.headers.entries()]).toEqual([...foreign.headers.entries()]);
  });

  test("checks the licence only after authorization, so a non-member learns nothing about it", async () => {
    mockCan.mockResolvedValue(false);

    await check("org_1");

    expect(mockGetIsDataRetentionEnabled).not.toHaveBeenCalled();
  });

  test("returns 403 explaining the plan when the organization isn't entitled", async () => {
    mockGetIsDataRetentionEnabled.mockResolvedValue(false);

    const response = (await check("org_1")) as Response;

    expect(response.status).toBe(403);
    expect((await response.json()).detail).toBe(RETENTION_NOT_ENABLED_DETAIL);
  });
});
