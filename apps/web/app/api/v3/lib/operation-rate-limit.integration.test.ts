import { describe, expect, test, vi } from "vitest";
import { acquireInFlightSlot, releaseInFlightSlot } from "@/modules/core/rate-limit/in-flight";
import { withV3OperationSlot } from "./operation-rate-limit";
import type { TV3Authentication } from "./types";

/**
 * The in-flight slots against real Redis: a slot is held for exactly as long as its operation runs, so
 * the limit is on operations running at once, not on how many start in a window — and a slot nobody gives
 * back frees itself when its lease runs out.
 */

// The integration setup turns rate limiting off for every suite; this one is about the limiter itself.
vi.mock("@/lib/constants", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/constants")>()),
  RATE_LIMITING_DISABLED: false,
}));

/** One namespace for the whole run, so principals share it as they do in production. */
const NAMESPACE = `test:in-flight:${Date.now()}`;

const slotFor = (principal: string) => ({
  config: { interval: 120, allowedPerInterval: 2, namespace: NAMESPACE },
  authentication: { apiKeyId: principal, workspacePermissions: [] } as unknown as TV3Authentication,
  requestId: "req",
  instance: "/api/v3/charts/preview",
});

/** An operation that runs until `release` is called. */
const held = () => {
  let release = () => {};
  const done = new Promise<void>((resolve) => {
    release = resolve;
  });
  return {
    release: () => release(),
    operation: async () => {
      await done;
      return Response.json({ ok: true });
    },
  };
};

describe("withV3OperationSlot against Redis", () => {
  test("refuses a third operation while two run, and admits one again as soon as one ends", async () => {
    const slot = slotFor("key_held");
    const first = held();
    const second = held();

    const running = [withV3OperationSlot(slot, first.operation), withV3OperationSlot(slot, second.operation)];
    // Both reservations land before the third asks.
    await new Promise((resolve) => setTimeout(resolve, 50));

    const refused = await withV3OperationSlot(slot, async () => Response.json({ ok: true }));
    expect(refused.status).toBe(429);
    expect(refused.headers.get("Retry-After")).toBe("1");

    first.release();
    expect((await running[0]).status).toBe(200);
    expect((await withV3OperationSlot(slot, async () => Response.json({ ok: true }))).status).toBe(200);

    second.release();
    await running[1];
  });

  test("releases the slot of an operation that failed", async () => {
    const slot = slotFor("key_failing");
    for (let attempt = 0; attempt < 3; attempt++) {
      await expect(
        withV3OperationSlot(slot, async () => {
          throw new Error("cube down");
        })
      ).rejects.toThrow("cube down");
    }

    expect((await withV3OperationSlot(slot, async () => Response.json({ ok: true }))).status).toBe(200);
  });

  test("keeps each principal's slots its own", async () => {
    const busy = slotFor("key_busy");
    const other = slotFor("key_other");
    const holds = [held(), held()];
    const running = holds.map((hold) => withV3OperationSlot(busy, hold.operation));
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect((await withV3OperationSlot(other, async () => Response.json({ ok: true }))).status).toBe(200);

    for (const hold of holds) hold.release();
    await Promise.all(running);
  });

  test("frees a slot nobody gave back once its lease runs out, while others keep the set alive", async () => {
    const config = { interval: 1, allowedPerInterval: 2, namespace: NAMESPACE };
    const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

    // A crashed pod's slot: taken, never given back.
    expect((await acquireInFlightSlot(config, "key_crashed")).allowed).toBe(true);
    // Another query renews the set's own expiry part-way through the crashed slot's lease.
    await sleep(600);
    const renewing = await acquireInFlightSlot(config, "key_crashed");
    expect(renewing.allowed).toBe(true);
    if (renewing.slot) await releaseInFlightSlot(renewing.slot);

    // The crashed slot's lease is over but the set is still alive: both slots are free again.
    await sleep(500);
    expect((await acquireInFlightSlot(config, "key_crashed")).allowed).toBe(true);
    expect((await acquireInFlightSlot(config, "key_crashed")).allowed).toBe(true);
  });
});
