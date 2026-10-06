import { afterAll, describe, expect, test } from "vitest";
import { prisma } from "@formbricks/database";
import { PrismaClient } from "../../../packages/database/generated/prisma-test/client";
import { createPrismaPgAdapter } from "../../../packages/database/src/prisma-adapter";

/**
 * ENG-3285: why the app needs Prisma >= 7.9 (prisma/orm#29727).
 *
 * When a transaction's start overruns `maxWait` (2 s by default) and the pool hands the connection over
 * afterwards, Prisma 7.8's adapter-pg discarded it with a bare release: `BEGIN` had already run, so the
 * connection went back to the pool inside an open transaction. The next query to borrow it ran inside
 * that leaked transaction and held its row locks until something happened to commit. Our pool queues
 * for up to 5 s against the 2 s `maxWait`, so any 2–5 s wait for a connection set this up in production.
 *
 * Driven against the real pool and Postgres, because the defect only exists at the driver boundary: a
 * one-connection pool makes the overrun deterministic, and Postgres itself reports the leaked state.
 */
const APPLICATION_NAME = "eng3285_transaction_start_leak";
const HOLD_MS = 3_000;

const leakClient = (() => {
  const url = new URL(process.env.DATABASE_URL ?? "");
  url.searchParams.set("connection_limit", "1");
  // Long enough that the pool keeps queueing past Prisma's 2 s maxWait instead of failing first.
  url.searchParams.set("connect_timeout", "30");
  url.searchParams.set("application_name", APPLICATION_NAME);
  // Prisma's default transaction options on purpose: the 2 s maxWait is what this scenario needs.
  return new PrismaClient({ adapter: createPrismaPgAdapter(url.toString()).adapter });
})();

afterAll(async () => {
  await leakClient.$disconnect();
});

const sessionState = async (): Promise<string | undefined> => {
  const rows = await prisma.$queryRaw<{ state: string }[]>`
    SELECT state FROM pg_stat_activity WHERE application_name = ${APPLICATION_NAME}
  `;
  return rows[0]?.state;
};

describe("a transaction start that overruns maxWait (prisma/orm#29727)", () => {
  test("returns its connection to the pool outside any transaction", async () => {
    // A holds the only connection; B queues for it and gives up at maxWait while A still holds it.
    const holder = leakClient.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_sleep(${HOLD_MS / 1000})`;
    });
    await new Promise((resolve) => setTimeout(resolve, 100));
    const overrun = leakClient.$transaction(async (tx) => tx.$queryRaw`SELECT 1`);

    // Premise: B really did time out waiting to start, rather than starting late.
    await expect(overrun).rejects.toMatchObject({ code: "P2028" });
    await holder;

    // Once A releases, the pool hands the connection to B's abandoned start, which runs BEGIN. Wait for
    // that hand-off to settle: 7.10 rolls back to `idle`; 7.8 leaves `idle in transaction`.
    const deadline = Date.now() + 3_000;
    let state = await sessionState();
    while (state !== "idle" && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 50));
      state = await sessionState();
    }
    expect(state).toBe("idle");

    // And the next ordinary query runs in a transaction of its own, not inside a leaked one: inside an
    // open transaction now() is frozen at its start, so it would differ from statement_timestamp().
    const [{ fresh }] = await leakClient.$queryRaw<{ fresh: boolean }[]>`
      SELECT now() = statement_timestamp() AS fresh
    `;
    expect(fresh).toBe(true);
  }, 20_000);
});
