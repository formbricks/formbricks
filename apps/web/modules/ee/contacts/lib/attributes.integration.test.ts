import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import { resetDb } from "@/integration/reset-db";
import { updateAttributes } from "@/modules/ee/contacts/lib/attributes";

/**
 * ENG-2252: concurrent identify calls (`POST /api/v2/client/{environmentId}/user`) for the SAME
 * contact deadlock when their payloads carry the same attribute keys in different orders.
 *
 * `updateAttributes` runs one upsert per attribute inside a single `$transaction`, in
 * `Object.entries(...)` order — i.e. caller-supplied key order. Two concurrent transactions that
 * touch the same `ContactAttribute` rows in opposite orders acquire the row locks in opposite
 * orders, form a lock cycle, and Postgres aborts one of them with SQLSTATE 40P01 ("deadlock
 * detected") — which the client API surfaces as a 500. The failure lives in real DB locking, not in
 * any mockable layer, so this drives the real prisma client against real Postgres (same rationale
 * as prisma-constraint.integration.test.ts).
 *
 * Deadlock mechanics make the repro all-but-deterministic rather than strictly guaranteed: each
 * round races callers whose payloads are exact reverses of each other across enough rows (21) that
 * two overlapping transactions must cross somewhere in the middle, and runs several rounds. On the
 * unfixed code this fails reliably; a fix that orders the upserts deterministically (and/or retries
 * on 40P01) makes it pass deterministically.
 */

const ATTRIBUTE_COUNT = 20;
const ROUNDS = 5;
const CALLERS_PER_ORDER = 2;

const USER_ID = "eng-2252-user";

beforeEach(async () => {
  await resetDb();
});

afterEach(() => {
  vi.restoreAllMocks();
});

/** A promise plus its resolver, for stepping two transactions through an interleaving. */
const createGate = (): { wait: Promise<void>; open: () => void } => {
  let open!: () => void;
  const wait = new Promise<void>((resolve) => {
    open = () => resolve();
  });
  return { wait, open };
};

/**
 * Block until Postgres reports a lock request that has not been granted — i.e. our identify
 * transaction is genuinely waiting on the row the competitor holds. Polling the real lock state
 * replaces "sleep and hope": on a loaded machine a fixed delay lets the competitor take its second
 * row before we ever block, no cycle forms, and the test silently stops proving anything.
 */
const waitForBlockedLock = async (timeoutMs = 15_000): Promise<void> => {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const [{ blocked }] = await prisma.$queryRaw<Array<{ blocked: number }>>`
      SELECT count(*)::int AS blocked FROM pg_locks WHERE NOT granted
    `;
    if (blocked > 0) return;
    if (Date.now() > deadline) {
      throw new Error("timed out waiting for a blocked lock — the intended deadlock never set up");
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
};

const seedContactWithAttributes = async (
  keys: string[]
): Promise<{ workspaceId: string; contactId: string; attributeKeyIdsSorted: string[] }> => {
  const organization = await prisma.organization.create({ data: { name: "ENG-2252 org" } });
  const workspace = await prisma.workspace.create({
    data: { name: "ENG-2252 workspace", organizationId: organization.id },
  });
  const contact = await prisma.contact.create({ data: { workspaceId: workspace.id } });

  await prisma.contactAttributeKey.createMany({
    data: keys.map((key) => ({
      key,
      name: key,
      type: key === "userId" ? "default" : "custom",
      workspaceId: workspace.id,
    })),
  });
  const attributeKeys = await prisma.contactAttributeKey.findMany({
    where: { workspaceId: workspace.id },
  });
  await prisma.contactAttribute.createMany({
    data: attributeKeys.map((attributeKey) => ({
      contactId: contact.id,
      attributeKeyId: attributeKey.id,
      value: attributeKey.key === "userId" ? USER_ID : "initial",
    })),
  });

  return {
    workspaceId: workspace.id,
    contactId: contact.id,
    // The order updateAttributes now locks in.
    attributeKeyIdsSorted: attributeKeys.map((k) => k.id).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)),
  };
};

describe("updateAttributes under concurrent identify calls (ENG-2252)", () => {
  test("concurrent updates of one contact with differently-ordered payloads all succeed", async () => {
    const organization = await prisma.organization.create({ data: { name: "ENG-2252 org" } });
    const workspace = await prisma.workspace.create({
      data: { name: "ENG-2252 workspace", organizationId: organization.id },
    });
    const contact = await prisma.contact.create({ data: { workspaceId: workspace.id } });

    // "userId" plus 20 custom keys. Zero-padded so ascending name order is unambiguous.
    const keys = [
      "userId",
      ...Array.from({ length: ATTRIBUTE_COUNT }, (_, i) => `attr_${String(i).padStart(2, "0")}`),
    ];
    await prisma.contactAttributeKey.createMany({
      data: keys.map((key) => ({
        key,
        name: key,
        type: key === "userId" ? "default" : "custom",
        workspaceId: workspace.id,
      })),
    });
    const attributeKeys = await prisma.contactAttributeKey.findMany({
      where: { workspaceId: workspace.id },
    });

    // Pre-create one row per key so every payload entry takes the existing-attribute upsert path —
    // the shape of a repeat identify call for a known contact, where the deadlock occurs.
    await prisma.contactAttribute.createMany({
      data: attributeKeys.map((attributeKey) => ({
        contactId: contact.id,
        attributeKeyId: attributeKey.id,
        value: attributeKey.key === "userId" ? USER_ID : "initial",
      })),
    });

    // Same key set, opposite insertion order — Object.entries() preserves it, so the two payload
    // shapes upsert (and lock) the same rows in opposite orders.
    const buildPayload = (round: number, reversed: boolean): Record<string, string> => {
      const orderedKeys = reversed ? [...keys].reverse() : keys;
      return Object.fromEntries(
        orderedKeys.map((key) => [key, key === "userId" ? USER_ID : `round-${round}`])
      );
    };

    for (let round = 0; round < ROUNDS; round++) {
      const calls = Array.from({ length: CALLERS_PER_ORDER * 2 }, (_, i) =>
        updateAttributes(contact.id, USER_ID, workspace.id, buildPayload(round, i % 2 === 1))
      );

      const results = await Promise.allSettled(calls);

      const failures = results
        .filter((result): result is PromiseRejectedResult => result.status === "rejected")
        .map((failure) => String(failure.reason));
      expect(failures, `round ${round}: concurrent identify calls must not fail`).toEqual([]);

      for (const result of results) {
        if (result.status === "fulfilled") {
          expect(result.value.success).toBe(true);
        }
      }
    }

    // Whichever caller committed last, every attribute row must hold a value from the final round —
    // no row may be left behind by an aborted transaction.
    const finalAttributes = await prisma.contactAttribute.findMany({
      where: { contactId: contact.id },
      select: { value: true, attributeKey: { select: { key: true } } },
    });
    expect(finalAttributes).toHaveLength(keys.length);
    for (const attribute of finalAttributes) {
      const expected = attribute.attributeKey.key === "userId" ? USER_ID : `round-${ROUNDS - 1}`;
      expect(attribute.value).toBe(expected);
    }
  });

  /**
   * The retry is the second line of defense, and deterministic ordering means the test above no
   * longer reaches it — so it would ship unproven against a real database. The unit tests reject a
   * synthetic error from a mocked `$transaction`, which cannot show that a REAL driver-adapter 40P01
   * is classified as a deadlock, nor that re-running a batch `$transaction` (fresh PrismaPromises on
   * the second attempt) actually recovers.
   *
   * This forces a cycle that ordering cannot prevent — a competing writer taking the same two rows in
   * the opposite order — and makes OUR transaction the victim: Postgres aborts whichever backend
   * detects the cycle, and a backend detects it once its lock wait exceeds its own `deadlock_timeout`.
   * Raising that to 20s on the competing session (SET LOCAL, so it dies with the transaction) leaves
   * our session, on the 1s default, as the detector — and therefore the one aborted with 40P01.
   */
  test("recovers when a competing writer forces a real 40P01 that ordering cannot prevent", async () => {
    const { workspaceId, contactId, attributeKeyIdsSorted } = await seedContactWithAttributes([
      "userId",
      "attr_a",
      "attr_b",
    ]);
    const firstLocked = attributeKeyIdsSorted[0];
    const lastLocked = attributeKeyIdsSorted[attributeKeyIdsSorted.length - 1];

    const warn = vi.spyOn(logger, "warn");
    const competitorHoldsLastRow = createGate();
    const identifyIsInFlight = createGate();

    // Competing writer: takes the LAST row in our lock order first, then the first — the reverse
    // order, which is what ordering alone cannot defend against.
    const competingWriter = prisma.$transaction(
      async (tx) => {
        await tx.$executeRawUnsafe("SET LOCAL deadlock_timeout = '20s'");
        await tx.$queryRaw`
          SELECT "id" FROM "ContactAttribute"
          WHERE "contactId" = ${contactId} AND "attributeKeyId" = ${lastLocked}
          FOR UPDATE
        `;
        competitorHoldsLastRow.open();

        await identifyIsInFlight.wait;
        // Blocks until our aborted transaction rolls back and releases this row, then commits
        // immediately — so our retry finds both rows free.
        await tx.$queryRaw`
          SELECT "id" FROM "ContactAttribute"
          WHERE "contactId" = ${contactId} AND "attributeKeyId" = ${firstLocked}
          FOR UPDATE
        `;
      },
      { timeout: 25_000, maxWait: 25_000 }
    );

    await competitorHoldsLastRow.wait;
    const identify = updateAttributes(contactId, USER_ID, workspaceId, {
      userId: USER_ID,
      attr_a: "recovered",
      attr_b: "recovered",
    });
    // Wait until the identify transaction actually holds the first row and is blocked on the last,
    // so the competitor's request for the first row closes the cycle rather than merely queueing.
    await waitForBlockedLock();
    identifyIsInFlight.open();

    const [identifyResult] = await Promise.all([identify, competingWriter]);

    expect(identifyResult.success).toBe(true);
    // The retry ran: a real driver-adapter 40P01 was classified as a deadlock and re-attempted.
    expect(warn).toHaveBeenCalledWith(
      expect.objectContaining({ operation: "updateAttributes.existingAttributes", attempt: 1 }),
      "Retrying transaction after Postgres deadlock"
    );
    // ...and the retried batch committed, so the writes are not silently lost.
    const values = await prisma.contactAttribute.findMany({
      where: { contactId, attributeKeyId: { not: attributeKeyIdsSorted[0] } },
      select: { value: true, attributeKey: { select: { key: true } } },
    });
    for (const attribute of values.filter((v) => v.attributeKey.key.startsWith("attr_"))) {
      expect(attribute.value).toBe("recovered");
    }
  }, 40_000);
});
