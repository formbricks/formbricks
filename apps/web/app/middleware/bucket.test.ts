import * as constants from "@/lib/constants";
import { rateLimit } from "@/lib/utils/rate-limit";
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { Mock } from "vitest";

vi.mock("@/lib/utils/rate-limit", () => ({ rateLimit: vi.fn() }));

describe("bucket middleware rate limiters", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    const mockedRateLimit = rateLimit as unknown as Mock;
    mockedRateLimit.mockImplementation((config) => config);
  });

  test("clientSideApiEndpointsLimiter uses CLIENT_SIDE_API_RATE_LIMIT settings", async () => {
    const { clientSideApiEndpointsLimiter } = await import("./bucket");
    expect(rateLimit).toHaveBeenCalledWith({
      interval: constants.CLIENT_SIDE_API_RATE_LIMIT.interval,
      allowedPerInterval: constants.CLIENT_SIDE_API_RATE_LIMIT.allowedPerInterval,
    });
    expect(clientSideApiEndpointsLimiter).toEqual({
      interval: constants.CLIENT_SIDE_API_RATE_LIMIT.interval,
      allowedPerInterval: constants.CLIENT_SIDE_API_RATE_LIMIT.allowedPerInterval,
    });
  });

  test("syncUserIdentificationLimiter uses SYNC_USER_IDENTIFICATION_RATE_LIMIT settings", async () => {
    const { syncUserIdentificationLimiter } = await import("./bucket");
    expect(rateLimit).toHaveBeenCalledWith({
      interval: constants.SYNC_USER_IDENTIFICATION_RATE_LIMIT.interval,
      allowedPerInterval: constants.SYNC_USER_IDENTIFICATION_RATE_LIMIT.allowedPerInterval,
    });
    expect(syncUserIdentificationLimiter).toEqual({
      interval: constants.SYNC_USER_IDENTIFICATION_RATE_LIMIT.interval,
      allowedPerInterval: constants.SYNC_USER_IDENTIFICATION_RATE_LIMIT.allowedPerInterval,
    });
  });
});
