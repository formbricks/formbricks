import posthog from "posthog-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { captureFailedSignup, verifyTurnstileToken } from "./utils";

beforeEach(() => {
  global.fetch = vi.fn();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.resetAllMocks();
  vi.useRealTimers();
});

describe("verifyTurnstileToken", () => {
  const secretKey = "test-secret";
  const token = "test-token";

  it("should return true when verification is successful", async () => {
    const mockResponse = { success: true };
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(mockResponse),
    });

    const result = await verifyTurnstileToken(secretKey, token);
    expect(result).toBe(true);
    expect(fetch).toHaveBeenCalledWith(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret: secretKey, response: token }),
        signal: expect.any(AbortSignal),
      })
    );
  });

  it("should return false when response is not ok", async () => {
    (global.fetch as any).mockResolvedValue({
      ok: false,
      status: 400,
    });

    const result = await verifyTurnstileToken(secretKey, token);
    expect(result).toBe(false);
  });

  it("should return false when verification fails", async () => {
    (global.fetch as any).mockRejectedValue(new Error("Network error"));

    const result = await verifyTurnstileToken(secretKey, token);
    expect(result).toBe(false);
  });

  it("should return false when request times out", async () => {
    const mockAbortError = new Error("The operation was aborted");
    mockAbortError.name = "AbortError";
    (global.fetch as any).mockRejectedValue(mockAbortError);

    const result = await verifyTurnstileToken(secretKey, token);
    expect(result).toBe(false);
  });
});

describe("captureFailedSignup", () => {
  it("should capture TELEMETRY_FAILED_SIGNUP event with email and name", () => {
    const captureSpy = vi.spyOn(posthog, "capture");
    const email = "test@example.com";
    const name = "Test User";

    captureFailedSignup(email, name);

    expect(captureSpy).toHaveBeenCalledWith("TELEMETRY_FAILED_SIGNUP", {
      email,
      name,
    });
  });
});
