import { beforeEach, describe, expect, test, vi } from "vitest";
import { applyRateLimit } from "@/modules/core/rate-limit/helpers";
import { getBulkInvitePermission } from "@/modules/ee/license-check/lib/utils";
import { applyInviteRateLimit, getInviteRateLimitConfig } from "./invite-rate-limit";

const constants = vi.hoisted(() => ({
  isFormbricksCloud: false,
}));

vi.mock("@/lib/constants", () => ({
  get IS_FORMBRICKS_CLOUD() {
    return constants.isFormbricksCloud;
  },
  INVITE_RATE_LIMIT_PER_24_HOURS: 75,
}));

vi.mock("@/modules/ee/license-check/lib/utils", () => ({
  getBulkInvitePermission: vi.fn(),
}));

vi.mock("@/modules/core/rate-limit/helpers", () => ({
  applyRateLimit: vi.fn(),
}));

describe("getInviteRateLimitConfig", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    constants.isFormbricksCloud = false;
  });

  test("uses the configured instance limit on self-hosted deployments", async () => {
    const config = await getInviteRateLimitConfig("org_1");

    expect(config).toEqual({
      interval: 3600 * 24,
      allowedPerInterval: 75,
      namespace: "action:invite-member",
    });
    expect(getBulkInvitePermission).not.toHaveBeenCalled();
  });

  test("uses the default limit on cloud without the bulk-invite entitlement", async () => {
    constants.isFormbricksCloud = true;
    vi.mocked(getBulkInvitePermission).mockResolvedValueOnce(false);

    const config = await getInviteRateLimitConfig("org_1");

    expect(config.allowedPerInterval).toBe(50);
    expect(getBulkInvitePermission).toHaveBeenCalledWith("org_1");
  });

  test("raises the cloud limit for organizations with the bulk-invite entitlement", async () => {
    constants.isFormbricksCloud = true;
    vi.mocked(getBulkInvitePermission).mockResolvedValueOnce(true);

    const config = await getInviteRateLimitConfig("org_1");

    expect(config.allowedPerInterval).toBe(500);
  });

  test("applies the recipient count to the organization budget", async () => {
    vi.mocked(applyRateLimit).mockResolvedValueOnce({ allowed: true });

    await applyInviteRateLimit("org_1", 25);

    expect(applyRateLimit).toHaveBeenCalledWith(
      {
        interval: 3600 * 24,
        allowedPerInterval: 75,
        namespace: "action:invite-member",
      },
      "org_1",
      25
    );
  });
});
