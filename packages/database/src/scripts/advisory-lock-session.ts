import { Client } from "pg";
import { getPgConnectionConfig } from "../pg-connection-config";

/** One PostgreSQL session that holds an advisory lock, independent of Prisma's pool. */
export type AdvisoryLockSession = {
  client: Client;
  assertLock: () => Promise<void>;
  signal: AbortSignal;
  close: () => Promise<void>;
};

export type AdvisoryLock = {
  namespace: number;
  id: number;
  // Thrown when another session already holds the lock.
  heldElsewhereError: string;
  // Thrown, and set as the abort reason, once this session no longer holds the lock.
  lostError: string;
};

// A session advisory lock belongs to one connection, so it lives on a client of its own. If the
// connection drops, Postgres releases the lock: the signal aborts and a heartbeat notices within two
// seconds, so the work it guards can stop before another session takes the lock over.
export const openAdvisoryLockSession = async (
  connectionString: string,
  lock: AdvisoryLock
): Promise<AdvisoryLockSession> => {
  const client = new Client({ ...getPgConnectionConfig(connectionString), connectionTimeoutMillis: 10_000 });
  const controller = new AbortController();
  const loseLock = () => controller.abort(new Error(lock.lostError));
  client.on("error", loseLock);
  client.on("end", loseLock);
  let pid: number;
  try {
    await client.connect();
    const { rows } = await client.query<{ pid: number; locked: boolean }>(
      "SELECT pg_backend_pid() AS pid, pg_try_advisory_lock($1, $2) AS locked",
      [lock.namespace, lock.id]
    );
    if (!rows[0]?.locked) throw new Error(lock.heldElsewhereError);
    pid = rows[0].pid;
  } catch (error) {
    await client.end().catch(() => {});
    throw error;
  }
  const assertLock = async () => {
    if (controller.signal.aborted) throw new Error(lock.lostError);
    const result = await client.query<{ held: boolean }>(
      `
      SELECT pg_backend_pid() = $1 AND EXISTS (
        SELECT 1 FROM pg_locks WHERE pid = $1 AND locktype = 'advisory'
          AND classid = $2 AND objid = $3 AND objsubid = 2 AND granted
      ) AS held`,
      [pid, lock.namespace, lock.id]
    );
    if (!result.rows[0]?.held) {
      loseLock();
      throw new Error(lock.lostError);
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
        await client.query("SELECT pg_advisory_unlock($1, $2)", [lock.namespace, lock.id]);
      } finally {
        await client.end();
      }
    },
  };
};
