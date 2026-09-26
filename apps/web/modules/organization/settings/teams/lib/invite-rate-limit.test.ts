import { beforeEach, describe, expect, test, vi } from "vitest";
import { reserveRateLimitUsage, settleRateLimitUsage } from "@/modules/core/rate-limit/helpers";
import type { TRateLimitReservation } from "@/modules/core/rate-limit/rate-limit";
import { getBulkInvitePermission } from "@/modules/ee/license-check/lib/utils";
import { getInviteRateLimitConfig, reserveInviteRateLimit, settleInviteRateLimit } from "./invite-rate-limit";

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
  reserveRateLimitUsage: vi.fn(),
  settleRateLimitUsage: vi.fn(),
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
    vi.mocked(reserveRateLimitUsage).mockResolvedValueOnce(undefined);

    await reserveInviteRateLimit("org_1", 25);

    expect(reserveRateLimitUsage).toHaveBeenCalledWith(
      {
        interval: 3600 * 24,
        allowedPerInterval: 75,
        namespace: "action:invite-member",
      },
      "org_1",
      25
    );
  });

  test("settles the reservation to the successful recipient count", async () => {
    const reservation: TRateLimitReservation = {
      identifier: "org_1",
      key: "rate-limit-key",
      namespace: "action:invite-member",
      requested: 25,
      settled: false,
    };

    await settleInviteRateLimit(reservation, 10);

    expect(settleRateLimitUsage).toHaveBeenCalledWith(reservation, 10);
  });
});
