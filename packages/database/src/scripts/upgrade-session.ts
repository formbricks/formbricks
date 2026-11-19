import { Client, type QueryResultRow } from "pg";
import { getPgConnectionConfig } from "../pg-connection-config";
import { type AdvisoryLockSession, openAdvisoryLockSession } from "./advisory-lock-session";

/** Owns one PostgreSQL session for the entire coordinator, independent of Prisma's pool. */
export type UpgradeSession = AdvisoryLockSession;

export const openUpgradeSession = (connectionString: string): Promise<UpgradeSession> =>
  openAdvisoryLockSession(connectionString, {
    namespace: 19062026,
    id: 61,
    heldElsewhereError: "upgrade_already_running",
    lostError: "upgrade_lock_lost",
  });

/** SQL and its Prisma history record commit together, so interruption cannot leave a partial migration. */
export const applyOnlineSchemaMigrations = async (
  session: Awaited<ReturnType<typeof openUpgradeSession>>,
  migrations: readonly { name: string; checksum: string; sql: string }[]
): Promise<void> => {
  for (const migration of migrations) {
    await session.assertLock();
    const applied = await session.client.query<{ checksum: string }>(
      "SELECT checksum FROM _prisma_migrations WHERE migration_name = $1 AND finished_at IS NOT NULL AND rolled_back_at IS NULL",
      [migration.name]
    );
    if (applied.rows.length) {
      if (applied.rows[0].checksum !== migration.checksum) throw new Error("divergent_schema_history");
      continue;
    }
    await session.client.query("BEGIN");
    try {
      await session.client.query("SET LOCAL lock_timeout = '1s'; SET LOCAL statement_timeout = '5min'");
      await session.client.query(migration.sql);
      await session.assertLock();
      await session.client.query(
        `INSERT INTO _prisma_migrations
        (id, checksum, migration_name, started_at, finished_at, applied_steps_count)
        VALUES (gen_random_uuid(), $1, $2, now(), now(), 1)`,
        [migration.checksum, migration.name]
      );
      await session.client.query("COMMIT");
    } catch (error) {
      await session.client.query("ROLLBACK").catch(() => {});
      throw error;
    }
  }
};

/** Status must remain available while another connection owns the coordinator lock. */
export const readOnlineUpgradeCheckpoint = async <T extends QueryResultRow>(
  connectionString: string,
  release: string
): Promise<T | null> => {
  const client = new Client({
    ...getPgConnectionConfig(connectionString),
    connectionTimeoutMillis: 10_000,
    statement_timeout: 10_000,
  });
  try {
    await client.connect();
    const table = await client.query<{ exists: boolean }>(
      `SELECT to_regclass('"OnlineUpgradeState"') IS NOT NULL AS exists`
    );
    if (!table.rows[0].exists) return null;
    return (
      (await client.query<T>('SELECT * FROM "OnlineUpgradeState" WHERE release = $1', [release])).rows[0] ??
      null
    );
  } finally {
    await client.end();
  }
};
