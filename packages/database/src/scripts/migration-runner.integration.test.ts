import { Client } from "pg";
import { afterAll, beforeAll, beforeEach, expect, test } from "vitest";
import { getPgConnectionConfig } from "../pg-connection-config";
import type { AutocommitDataMigrationContext, MigrationScript } from "./migration-runner";

// Opt in only against a disposable database: this fixture creates its own schema and drops it afterward.
const connection = process.env.ONLINE_UPGRADE_TEST_DATABASE_URL;
const schema = `migration_runner_${Date.now().toString()}`;
let schemaUrl: string;

const ID = "autocommit_takeover";
let client: Client;
let runDataMigration: (migration: MigrationScript) => Promise<void>;

const status = async (): Promise<string | undefined> =>
  (await client.query<{ status: string }>(`SELECT status FROM "DataMigration" WHERE id = $1`, [ID])).rows[0]
    ?.status;

const migration = (run: (context: AutocommitDataMigrationContext) => Promise<void>): MigrationScript => ({
  type: "data",
  id: ID,
  name: ID,
  transactional: false,
  run,
});

const deferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};

// The runner's per-migration lock namespace (migration-runner.ts).
const terminateLockHolder = () =>
  client.query(
    "SELECT pg_terminate_backend(pid) FROM pg_locks WHERE locktype = 'advisory' AND classid = 16212026 AND granted"
  );

beforeAll(async () => {
  if (!connection) return;
  const parsed = new URL(connection);
  parsed.searchParams.set("options", `-c search_path=${schema}`);
  schemaUrl = parsed.toString();
  // The runner reads its database URL when the module loads, so it is imported only once the URL is set.
  process.env.MIGRATE_DATABASE_URL = schemaUrl;
  ({ runDataMigration } = await import("./migration-runner"));

  client = new Client(getPgConnectionConfig(schemaUrl));
  await client.connect();
  await client.query(`CREATE SCHEMA "${schema}"`);
  await client.query(`CREATE TYPE "DataMigrationStatus" AS ENUM ('pending', 'applied', 'failed');
    CREATE TABLE "DataMigration" (id text PRIMARY KEY, started_at timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      finished_at timestamp(3), name text NOT NULL UNIQUE, status "DataMigrationStatus" NOT NULL)`);
});
beforeEach(async () => {
  if (!connection) return;
  await client.query(`DELETE FROM "DataMigration"`);
});
afterAll(async () => {
  if (!connection) return;
  await client.query(`DROP SCHEMA "${schema}" CASCADE`);
  await client.end();
});

test.skipIf(!connection).each(["finishes", "throws"])(
  "a runner that loses its lock and then %s records nothing; the runner that took over leaves it applied",
  async (outcome) => {
    const aStarted = deferred();
    const releaseA = deferred();
    const runnerA = runDataMigration(
      migration(async () => {
        aStarted.resolve();
        await releaseA.promise;
        if (outcome === "throws") throw new Error("chunk failed after the takeover");
      })
    );
    await aStarted.promise;
    expect(await status()).toBe("pending");

    await terminateLockHolder();
    await runDataMigration(migration(() => Promise.resolve()));
    expect(await status()).toBe("applied");

    releaseA.resolve();
    await expect(runnerA).rejects.toThrow();
    expect(await status()).toBe("applied");
  },
  30_000
);

test.skipIf(!connection)(
  "a second runner waits for the live one, then skips the finished migration",
  async () => {
    const aStarted = deferred();
    const releaseA = deferred();
    const runnerA = runDataMigration(
      migration(async () => {
        aStarted.resolve();
        await releaseA.promise;
      })
    );
    await aStarted.promise;

    let bRan = false;
    const runnerB = runDataMigration(
      migration(() => {
        bRan = true;
        return Promise.resolve();
      })
    );
    releaseA.resolve();
    await runnerA;
    await runnerB;

    expect(bRan).toBe(false);
    expect(await status()).toBe("applied");
  },
  30_000
);

test.skipIf(!connection)("resumes a pending migration nobody holds the lock for", async () => {
  await client.query(`INSERT INTO "DataMigration" (id, name, status) VALUES ($1, $1, 'pending')`, [ID]);
  let ran = false;

  await runDataMigration(
    migration(() => {
      ran = true;
      return Promise.resolve();
    })
  );

  expect(ran).toBe(true);
  expect(await status()).toBe("applied");
});
