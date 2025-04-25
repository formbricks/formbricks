import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { logger } from "@formbricks/logger";
import { verifyRecaptchaToken } from "./recaptcha";

// Mock constants
vi.mock("@/lib/constants", () => ({
  RECAPTCHA_SITE_KEY: "test-site-key",
  RECAPTCHA_SECRET_KEY: "test-secret-key",
}));

// Mock logger
vi.mock("@formbricks/logger", () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe("verifyRecaptchaToken", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("returns true if site key or secret key is missing", async () => {
    vi.doMock("@/lib/constants", () => ({
      RECAPTCHA_SITE_KEY: undefined,
      RECAPTCHA_SECRET_KEY: undefined,
    }));
    // Re-import to get new mocked values
    const { verifyRecaptchaToken: verifyWithNoKeys } = await import("./recaptcha");
    const result = await verifyWithNoKeys("token", 0.5);
    expect(result).toBe(true);
    expect(logger.warn).toHaveBeenCalledWith("reCAPTCHA verification skipped: keys not configured");
  });

  test("returns false if fetch response is not ok", async () => {
    (global.fetch as any).mockResolvedValue({ ok: false });
    const result = await verifyRecaptchaToken("token", 0.5);
    expect(result).toBe(false);
  });

  test("returns false if verification fails (data.success is false)", async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ success: false }),
    });
    const result = await verifyRecaptchaToken("token", 0.5);
    expect(result).toBe(false);
    expect(logger.error).toHaveBeenCalledWith({ success: false }, "reCAPTCHA verification failed");
  });

  test("returns false if score is below or equal to threshold", async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ success: true, score: 0.3 }),
    });
    const result = await verifyRecaptchaToken("token", 0.5);
    expect(result).toBe(false);
    expect(logger.error).toHaveBeenCalledWith(
      { success: true, score: 0.3 },
      "reCAPTCHA score below threshold"
    );
  });

  test("returns true if verification is successful and score is above threshold", async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ success: true, score: 0.9 }),
    });
    const result = await verifyRecaptchaToken("token", 0.5);
    expect(result).toBe(true);
  });

  test("returns true if verification is successful and score is undefined", async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ success: true }),
    });
    const result = await verifyRecaptchaToken("token", 0.5);
    expect(result).toBe(true);
  });

  test("returns false and logs error if fetch throws", async () => {
    (global.fetch as any).mockRejectedValue(new Error("network error"));
    const result = await verifyRecaptchaToken("token", 0.5);
    expect(result).toBe(false);
    expect(logger.error).toHaveBeenCalledWith(expect.any(Error), "Error verifying reCAPTCHA token");
  });

  test("aborts fetch after timeout", async () => {
    vi.useFakeTimers();
    let abortCalled = false;
    const abortController = {
      abort: () => {
        abortCalled = true;
      },
      signal: {},
    };
    vi.spyOn(global, "AbortController").mockImplementation(() => abortController as any);
    (global.fetch as any).mockImplementation(() => new Promise(() => {}));
    verifyRecaptchaToken("token", 0.5);
    vi.advanceTimersByTime(5000);
    expect(abortCalled).toBe(true);
  });
});
