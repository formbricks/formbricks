import { describe, expect, test, vi } from "vitest";
import { runChunked } from "./projection-chunks";

describe("runChunked", () => {
  test("aggregates reconciliation passes across every successful chunk", async () => {
    const reconcile = vi
      .fn()
      .mockResolvedValueOnce({ passes: 2, status: "projected" })
      .mockResolvedValueOnce({ passes: 3, status: "projected" });

    await expect(
      runChunked(reconcile, { memberships: Array.from({ length: 201 }, (_unused, index) => index) })
    ).resolves.toEqual({ passes: 5, status: "projected" });
    expect(reconcile).toHaveBeenCalledTimes(2);
  });

  test("stops at the first unsuccessful chunk", async () => {
    const failure = {
      attempts: 3,
      code: "authzed_projection_unstable" as const,
      retryable: false,
      status: "failed" as const,
    };
    const reconcile = vi
      .fn()
      .mockResolvedValueOnce({ passes: 1, status: "projected" })
      .mockResolvedValue(failure);

    await expect(
      runChunked(reconcile, { memberships: Array.from({ length: 401 }, (_unused, index) => index) })
    ).resolves.toEqual(failure);
    expect(reconcile).toHaveBeenCalledTimes(2);
  });
});
