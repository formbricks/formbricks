import { afterAll, describe, expect, test } from "vitest";
import { prisma } from "@formbricks/database";
import { PrismaClient } from "../../../packages/database/generated/prisma-test/client";
import { createAppPrismaClientOptions } from "../../../packages/database/src/client-options";

/**
 * ENG-3285: the app client asks Postgres to end any session left idle inside an open transaction, so a
 * stalled process or a leaked connection cannot sit on row locks indefinitely — something Prisma's own
 * transaction timeout cannot do, because it cancels nothing on the server. Checked as Postgres reports
 * it, through real connections, since the setting travels as a startup parameter.
 */
const extraClients: PrismaClient[] = [];

const clientWith = (idleInTransactionSessionTimeout: string): PrismaClient => {
  const url = new URL(process.env.DATABASE_URL ?? "");
  url.searchParams.set("idle_in_transaction_session_timeout", idleInTransactionSessionTimeout);
  const client = new PrismaClient(createAppPrismaClientOptions(url.toString()));
  extraClients.push(client);
  return client;
};

const showSetting = async (client: { $queryRaw: PrismaClient["$queryRaw"] }): Promise<string> => {
  const [row] = await client.$queryRaw<{ idle_in_transaction_session_timeout: string }[]>`
    SHOW idle_in_transaction_session_timeout
  `;
  return row.idle_in_transaction_session_timeout;
};

afterAll(async () => {
  await Promise.all(extraClients.map((client) => client.$disconnect()));
});

describe("app client idle_in_transaction_session_timeout (ENG-3285)", () => {
  test("is set on the app client's connections by default", async () => {
    expect(await showSetting(prisma)).toBe("1min");
  });

  test("follows a DATABASE_URL override, and 0 leaves the server default in place", async () => {
    expect(await showSetting(clientWith("5000"))).toBe("5s");
    expect(await showSetting(clientWith("0"))).toBe("0");
  });

  test("ends a session left idle inside a transaction, and the pool recovers", async () => {
    const client = clientWith("1000");

    const abandoned = client.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT 1`;
        // Idle inside the open transaction for longer than the server allows.
        await new Promise((resolve) => setTimeout(resolve, 2_000));
        await tx.$queryRaw`SELECT 1`;
      },
      { timeout: 10_000 }
    );

    await expect(abandoned).rejects.toThrow();
    // The pool discards the terminated connection and serves the next query on a fresh one.
    await expect(client.$queryRaw`SELECT 1 AS ok`).resolves.toEqual([{ ok: 1 }]);
  }, 30_000);
});
