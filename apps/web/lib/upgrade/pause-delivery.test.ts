import { afterEach, expect, test, vi } from "vitest";
import { createPauseDeliveryLoop } from "./pause-delivery";

vi.mock("@formbricks/database", () => ({ prisma: {} }));
vi.mock("@/lib/authzed/outbox-processor", () => ({ processAuthzedOutboxBatch: vi.fn() }));
vi.mock("@/lib/env", () => ({ env: {} }));
afterEach(() => vi.useRealTimers());

test("revocations keep delivering during a durable pause and stop after completion", async () => {
  vi.useFakeTimers();
  const checkpoint = {
    phase: "retiring_consumers",
    queuePausedAt: new Date(),
    queueResumedAt: null as Date | null,
  };
  const deliver = vi.fn(async () => {});
  const read = vi.fn(async () => checkpoint);
  const loop = createPauseDeliveryLoop({ read, deliver, onError: vi.fn() });
  await vi.advanceTimersByTimeAsync(2100);
  expect(deliver).toHaveBeenCalledTimes(3);
  checkpoint.queueResumedAt = new Date();
  checkpoint.phase = "complete";
  await vi.advanceTimersByTimeAsync(1000);
  const reads = read.mock.calls.length;
  await vi.advanceTimersByTimeAsync(5000);
  expect(read).toHaveBeenCalledTimes(reads);
  expect(deliver).toHaveBeenCalledTimes(3);
  await loop.close();
});

test("delivery errors retry without overlapping batches, and shutdown waits for the active batch", async () => {
  vi.useFakeTimers();
  const onError = vi.fn();
  let finish!: () => void;
  const deliver = vi
    .fn()
    .mockRejectedValueOnce(new Error("unavailable"))
    .mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        })
    );
  const loop = createPauseDeliveryLoop({
    read: async () => ({ phase: "draining_jobs", queuePausedAt: new Date(), queueResumedAt: null }),
    deliver,
    onError,
  });
  await vi.advanceTimersByTimeAsync(5000);
  expect(onError).toHaveBeenCalledOnce();
  expect(deliver).toHaveBeenCalledTimes(2);
  let closed = false;
  const close = loop.close().then(() => {
    closed = true;
  });
  await vi.advanceTimersByTimeAsync(1000);
  expect(closed).toBe(false);
  finish();
  await close;
  await vi.advanceTimersByTimeAsync(5000);
  expect(deliver).toHaveBeenCalledTimes(2);
});
