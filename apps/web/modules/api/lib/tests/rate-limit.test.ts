import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("@unkey/ratelimit", () => ({
  Ratelimit: vi.fn(),
}));

describe("when rate limiting is disabled", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.doMock("@formbricks/lib/constants", () => ({
      ...vi.importActual("@formbricks/lib/constants"),
      MANAGEMENT_API_RATE_LIMIT: { allowedPerInterval: 5, interval: 60 },
      RATE_LIMITING_DISABLED: true,
      UNKEY_ROOT_KEY: "dummy-key",
    }));
  });

  test("should log a warning once and return a stubbed response", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { rateLimiter } = await import("@/modules/api/lib/rate-limit");
    const limiterFunc = rateLimiter();

    const res1 = await limiterFunc({ identifier: "test-id" });
    expect(res1).toEqual({ success: true, limit: 10, remaining: 999, reset: 0 });
    expect(warnSpy).toHaveBeenCalledWith("Rate limiting disabled");

    // Subsequent calls won't log again.
    await limiterFunc({ identifier: "another-id" });
    expect(warnSpy).toHaveBeenCalledTimes(1);
    warnSpy.mockRestore();
  });
});

describe("when UNKEY_ROOT_KEY is missing", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.doMock("@formbricks/lib/constants", () => ({
      ...vi.importActual("@formbricks/lib/constants"),
      MANAGEMENT_API_RATE_LIMIT: { allowedPerInterval: 5, interval: 60 },
      RATE_LIMITING_DISABLED: false,
      UNKEY_ROOT_KEY: "",
    }));
  });

  test("should log a warning about missing UNKEY_ROOT_KEY and return stub response", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { rateLimiter } = await import("@/modules/api/lib/rate-limit");
    const limiterFunc = rateLimiter();

    const res = await limiterFunc({ identifier: "test-id" });
    expect(res).toEqual({ success: true, limit: 10, remaining: 999, reset: 0 });
    expect(warnSpy).toHaveBeenCalledWith("Disabled due to not finding UNKEY_ROOT_KEY env variable");
    warnSpy.mockRestore();
  });
});
