import { beforeEach, describe, expect, test } from "vitest";
import { prisma } from "@formbricks/database";
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
});
