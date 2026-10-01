import { describe, expect, test, vi } from "vitest";
import { runUntilExhausted } from "./utils";

describe("runUntilExhausted", () => {
  test("stops at the first empty batch and reports the totals", async () => {
    const runBatch = vi.fn().mockResolvedValueOnce(5000).mockResolvedValueOnce(12).mockResolvedValueOnce(0);

    await expect(runUntilExhausted(runBatch)).resolves.toEqual({ batches: 2, rows: 5012 });
    expect(runBatch).toHaveBeenCalledTimes(3);
  });

  test("is a no-op on an empty database", async () => {
    const runBatch = vi.fn().mockResolvedValue(0);

    await expect(runUntilExhausted(runBatch)).resolves.toEqual({ batches: 0, rows: 0 });
    expect(runBatch).toHaveBeenCalledTimes(1);
  });

  test("throws instead of looping forever when a batch never drains", async () => {
    const runBatch = vi.fn().mockResolvedValue(1);

    await expect(runUntilExhausted(runBatch, { maxBatches: 3 })).rejects.toThrow("did not converge");
    expect(runBatch).toHaveBeenCalledTimes(3);
  });
});
