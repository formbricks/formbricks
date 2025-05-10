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

  test("loginLimiter uses LOGIN_RATE_LIMIT settings", async () => {
    const { loginLimiter } = await import("./bucket");
    expect(rateLimit).toHaveBeenCalledWith({
      interval: constants.LOGIN_RATE_LIMIT.interval,
      allowedPerInterval: constants.LOGIN_RATE_LIMIT.allowedPerInterval,
    });
    expect(loginLimiter).toEqual({
      interval: constants.LOGIN_RATE_LIMIT.interval,
      allowedPerInterval: constants.LOGIN_RATE_LIMIT.allowedPerInterval,
    });
  });

  test("signupLimiter uses SIGNUP_RATE_LIMIT settings", async () => {
    const { signupLimiter } = await import("./bucket");
    expect(rateLimit).toHaveBeenCalledWith({
      interval: constants.SIGNUP_RATE_LIMIT.interval,
      allowedPerInterval: constants.SIGNUP_RATE_LIMIT.allowedPerInterval,
    });
    expect(signupLimiter).toEqual({
      interval: constants.SIGNUP_RATE_LIMIT.interval,
      allowedPerInterval: constants.SIGNUP_RATE_LIMIT.allowedPerInterval,
    });
  });

  test("verifyEmailLimiter uses VERIFY_EMAIL_RATE_LIMIT settings", async () => {
    const { verifyEmailLimiter } = await import("./bucket");
    expect(rateLimit).toHaveBeenCalledWith({
      interval: constants.VERIFY_EMAIL_RATE_LIMIT.interval,
      allowedPerInterval: constants.VERIFY_EMAIL_RATE_LIMIT.allowedPerInterval,
    });
    expect(verifyEmailLimiter).toEqual({
      interval: constants.VERIFY_EMAIL_RATE_LIMIT.interval,
      allowedPerInterval: constants.VERIFY_EMAIL_RATE_LIMIT.allowedPerInterval,
    });
  });

  test("forgotPasswordLimiter uses FORGET_PASSWORD_RATE_LIMIT settings", async () => {
    const { forgotPasswordLimiter } = await import("./bucket");
    expect(rateLimit).toHaveBeenCalledWith({
      interval: constants.FORGET_PASSWORD_RATE_LIMIT.interval,
      allowedPerInterval: constants.FORGET_PASSWORD_RATE_LIMIT.allowedPerInterval,
    });
    expect(forgotPasswordLimiter).toEqual({
      interval: constants.FORGET_PASSWORD_RATE_LIMIT.interval,
      allowedPerInterval: constants.FORGET_PASSWORD_RATE_LIMIT.allowedPerInterval,
    });
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

  test("shareUrlLimiter uses SHARE_RATE_LIMIT settings", async () => {
    const { shareUrlLimiter } = await import("./bucket");
    expect(rateLimit).toHaveBeenCalledWith({
      interval: constants.SHARE_RATE_LIMIT.interval,
      allowedPerInterval: constants.SHARE_RATE_LIMIT.allowedPerInterval,
    });
    expect(shareUrlLimiter).toEqual({
      interval: constants.SHARE_RATE_LIMIT.interval,
      allowedPerInterval: constants.SHARE_RATE_LIMIT.allowedPerInterval,
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
