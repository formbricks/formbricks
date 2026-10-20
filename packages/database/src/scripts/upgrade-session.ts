import { Client, type QueryResultRow } from "pg";
import { getPgConnectionConfig } from "../pg-connection-config";

const LOCK_NAMESPACE = 19062026;
const LOCK_ID = 61;

/** Owns one PostgreSQL session for the entire coordinator, independent of Prisma's pool. */
export type UpgradeSession = {
  client: Client;
  assertLock: () => Promise<void>;
  signal: AbortSignal;
  close: () => Promise<void>;
};

export const openUpgradeSession = async (connectionString: string): Promise<UpgradeSession> => {
  const client = new Client({ ...getPgConnectionConfig(connectionString), connectionTimeoutMillis: 10_000 });
  const controller = new AbortController();
  const loseLock = () => controller.abort(new Error("upgrade_lock_lost"));
  client.on("error", loseLock);
  client.on("end", loseLock);
  let pid: number;
  try {
    await client.connect();
    const { rows } = await client.query<{ pid: number; locked: boolean }>(
      "SELECT pg_backend_pid() AS pid, pg_try_advisory_lock($1, $2) AS locked",
      [LOCK_NAMESPACE, LOCK_ID]
    );
    if (!rows[0]?.locked) throw new Error("upgrade_already_running");
    pid = rows[0].pid;
  } catch (error) {
    await client.end().catch(() => {});
    throw error;
  }
  const assertLock = async () => {
    if (controller.signal.aborted) throw new Error("upgrade_lock_lost");
    const result = await client.query<{ held: boolean }>(
      `
      SELECT pg_backend_pid() = $1 AND EXISTS (
        SELECT 1 FROM pg_locks WHERE pid = $1 AND locktype = 'advisory'
          AND classid = $2 AND objid = $3 AND objsubid = 2 AND granted
      ) AS held`,
      [pid, LOCK_NAMESPACE, LOCK_ID]
    );
    if (!result.rows[0]?.held) {
      loseLock();
      throw new Error("upgrade_lock_lost");
    }
  };
  const heartbeat = setInterval(() => {
    void assertLock().catch(loseLock);
  }, 2_000);
  heartbeat.unref();
  return {
    client,
    assertLock,
    signal: controller.signal,
    close: async () => {
      clearInterval(heartbeat);
      try {
        await client.query("SELECT pg_advisory_unlock($1, $2)", [LOCK_NAMESPACE, LOCK_ID]);
      } finally {
        await client.end();
      }
    },
  };
};

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
