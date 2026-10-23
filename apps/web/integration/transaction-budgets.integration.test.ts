import { Client } from "pg";
import { afterAll, describe, expect, test } from "vitest";
import { PrismaClient } from "../../../packages/database/generated/prisma-test/client";
import { createAppPrismaClientOptions } from "../../../packages/database/src/client-options";

/**
 * ENG-3285: the app client can ask Postgres to end any session left idle inside an open transaction, so a
 * stalled process or a leaked connection cannot sit on row locks indefinitely — something Prisma's own
 * transaction timeout cannot do, because it cancels nothing on the server. Checked as Postgres reports
 * it, through real connections, since the setting travels as a startup parameter and is opt-in through
 * DATABASE_URL.
 */
const extraClients: PrismaClient[] = [];

const clientWith = (idleInTransactionSessionTimeout: string): PrismaClient => {
  const url = new URL(process.env.DATABASE_URL ?? "");
  url.searchParams.set("idle_in_transaction_session_timeout", idleInTransactionSessionTimeout);
  const client = new PrismaClient(createAppPrismaClientOptions(url.toString()));
  extraClients.push(client);
  return client;
};

/** The connection URL with the parameter removed — what an app connection sends when nobody opted in. */
const urlWithoutParameter = (): string => {
  const url = new URL(process.env.DATABASE_URL ?? "");
  url.searchParams.delete("idle_in_transaction_session_timeout");
  return url.toString();
};

const clientWithout = (): PrismaClient => {
  const client = new PrismaClient(createAppPrismaClientOptions(urlWithoutParameter()));
  extraClients.push(client);
  return client;
};

/**
 * The value a connection that carries no startup parameter sees — the server's own setting. "Sends
 * nothing" can only be asserted against this: a literal "0" fails wherever the server configures a
 * timeout of its own, and says nothing either way about what the app client sent.
 */
const serverDefault = async (): Promise<string> => {
  const client = new Client({ connectionString: urlWithoutParameter() });
  try {
    await client.connect();
    const result = await client.query<{ idle_in_transaction_session_timeout: string }>(
      "SHOW idle_in_transaction_session_timeout"
    );
    return result.rows[0].idle_in_transaction_session_timeout;
  } finally {
    await client.end().catch(() => undefined);
  }
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
  test("is not sent unless DATABASE_URL asks for it", async () => {
    expect(await showSetting(clientWithout())).toBe(await serverDefault());
  });

  test("follows the DATABASE_URL value, and 0 leaves the server default in place", async () => {
    expect(await showSetting(clientWith("5000"))).toBe("5s");
    expect(await showSetting(clientWith("0"))).toBe(await serverDefault());
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
