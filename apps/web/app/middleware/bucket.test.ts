import { beforeEach, describe, expect, test, vi } from "vitest";
import { loginLimiter, signupLimiter } from "./bucket";

// Mock constants
vi.mock("@/lib/constants", () => ({
  ENTERPRISE_LICENSE_KEY: undefined,
  REDIS_HTTP_URL: undefined,
  LOGIN_RATE_LIMIT: {
    interval: 15 * 60,
    allowedPerInterval: 5,
  },
  SIGNUP_RATE_LIMIT: {
    interval: 60 * 60,
    allowedPerInterval: 5,
  },
  VERIFY_EMAIL_RATE_LIMIT: {
    interval: 60 * 60,
    allowedPerInterval: 5,
  },
  FORGET_PASSWORD_RATE_LIMIT: {
    interval: 60 * 60,
    allowedPerInterval: 5,
  },
  CLIENT_SIDE_API_RATE_LIMIT: {
    interval: 60,
    allowedPerInterval: 5,
  },
  SHARE_RATE_LIMIT: {
    interval: 60,
    allowedPerInterval: 5,
  },
  SYNC_USER_IDENTIFICATION_RATE_LIMIT: {
    interval: 60,
    allowedPerInterval: 5,
  },
}));

describe("Rate Limiters", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("loginLimiter allows requests within limit", () => {
    const token = "test-token-1";
    // Should not throw for first request
    expect(() => loginLimiter(token)).not.toThrow();
  });

  test("loginLimiter throws when limit exceeded", () => {
    const token = "test-token-2";
    // Make multiple requests to exceed the limit
    for (let i = 0; i < 5; i++) {
      expect(() => loginLimiter(token)).not.toThrow();
    }
    // Next request should throw
    expect(() => loginLimiter(token)).toThrow("Rate limit exceeded");
  });

  test("different limiters use different counters", () => {
    const token = "test-token-3";
    // Exceed login limit
    for (let i = 0; i < 5; i++) {
      expect(() => loginLimiter(token)).not.toThrow();
    }
    // Should throw for login
    expect(() => loginLimiter(token)).toThrow("Rate limit exceeded");
    // Should still be able to use signup limiter
    expect(() => signupLimiter(token)).not.toThrow();
  });
});
