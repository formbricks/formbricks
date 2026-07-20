import { loggerMocks } from "./__mocks__/logger";
import { status } from "@grpc/grpc-js";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { AUTHZED_ERROR_CODES, AuthzedError } from "./errors";
import { calculateAuthzedRetryDelayMs, executeAuthzedOperation } from "./retry";

describe("AuthZed retry policy", () => {
  beforeEach(() => {
    loggerMocks.debug.mockReset();
    loggerMocks.warn.mockReset();
  });

  test("returns a first-attempt success without sleeping", async () => {
    const request = vi.fn().mockResolvedValue("success");
    const sleep = vi.fn();

    await expect(executeAuthzedOperation("read_schema", request, { sleep })).resolves.toBe("success");
    expect(request).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
    expect(loggerMocks.debug).not.toHaveBeenCalled();
    expect(loggerMocks.warn).not.toHaveBeenCalled();
  });

  test.each([
    [0, 0, 80],
    [0, 0.5, 100],
    [0, 1, 120],
    [1, 0, 160],
    [1, 0.5, 200],
    [1, 1, 240],
  ])("applies bounded jitter for retry %i at random value %f", (retryIndex, randomValue, expected) => {
    expect(calculateAuthzedRetryDelayMs(retryIndex, randomValue)).toBe(expected);
  });

  test("retries transient failures and succeeds on the third attempt", async () => {
    const request = vi
      .fn()
      .mockRejectedValueOnce({ code: status.UNAVAILABLE })
      .mockRejectedValueOnce({ code: status.RESOURCE_EXHAUSTED })
      .mockResolvedValue("success");
    const sleep = vi.fn().mockResolvedValue(undefined);
    const random = vi.fn().mockReturnValueOnce(0.5).mockReturnValueOnce(0.5);

    await expect(
      executeAuthzedOperation("read_schema", request, { now: () => 10, random, sleep })
    ).resolves.toBe("success");

    expect(request).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenNthCalledWith(1, 100);
    expect(sleep).toHaveBeenNthCalledWith(2, 200);
    expect(loggerMocks.debug).toHaveBeenCalledTimes(2);
    expect(loggerMocks.warn).not.toHaveBeenCalled();
  });

  test("uses the scheduled delay before succeeding on the second attempt", async () => {
    vi.useFakeTimers();
    const request = vi.fn().mockRejectedValueOnce({ code: status.ABORTED }).mockResolvedValue("success");

    try {
      const resultPromise = executeAuthzedOperation("read_schema", request, { random: () => 0.5 });
      await vi.advanceTimersByTimeAsync(99);
      expect(request).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(1);
      await expect(resultPromise).resolves.toBe("success");
      expect(request).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  test("stops after three attempts and exposes the final stable classification", async () => {
    const request = vi.fn().mockRejectedValue({ code: status.DEADLINE_EXCEEDED });
    const sleep = vi.fn().mockResolvedValue(undefined);

    const result = await executeAuthzedOperation("read_schema", request, {
      now: () => 10,
      random: () => 0.5,
      sleep,
    }).catch((error: unknown) => error);

    expect(result).toBeInstanceOf(AuthzedError);
    expect(result).toMatchObject({
      attempts: 3,
      code: AUTHZED_ERROR_CODES.TIMEOUT,
      grpcStatus: status.DEADLINE_EXCEEDED,
      retryable: true,
    });
    expect(request).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledTimes(2);
    expect(loggerMocks.warn).toHaveBeenCalledTimes(1);
  });

  test("does not retry permanent errors", async () => {
    const request = vi.fn().mockRejectedValue({ code: status.UNAUTHENTICATED });
    const sleep = vi.fn();

    const result = await executeAuthzedOperation("read_schema", request, { sleep }).catch(
      (error: unknown) => error
    );

    expect(result).toMatchObject({
      attempts: 1,
      code: AUTHZED_ERROR_CODES.UNAUTHENTICATED,
      retryable: false,
    });
    expect(request).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  test("logs only sanitized retry metadata", async () => {
    const token = "never-log-this-authzed-token";
    const request = vi.fn().mockRejectedValue({
      code: status.UNAUTHENTICATED,
      details: `Bearer ${token}`,
      metadata: { authorization: token },
    });

    await executeAuthzedOperation("read_schema", request).catch(() => undefined);

    const serializedLogs = JSON.stringify([...loggerMocks.debug.mock.calls, ...loggerMocks.warn.mock.calls]);
    expect(serializedLogs).toContain(AUTHZED_ERROR_CODES.UNAUTHENTICATED);
    expect(serializedLogs).not.toContain(token);
    expect(serializedLogs).not.toContain("metadata");
    expect(serializedLogs).not.toContain("Bearer");
  });
});
