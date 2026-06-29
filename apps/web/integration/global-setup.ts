/* eslint-disable turbo/no-undeclared-env-vars -- harness-only env overrides (TEST_*), not app config */
import { execSync } from "node:child_process";

/**
 * Vitest globalSetup for the Better Auth integration harness (ENG-1054).
 *
 * Provisions an isolated, BA-shaped copy of the Formbricks schema in a throwaway database:
 *  1. copy the dev DB's schema (schema-only) into `formbricks_ba_test`, then
 *  2. apply the two cutover adjustments Better Auth needs — `emailVerified` Date→Boolean and
 *     `Account.type` nullable.
 *
 * We deliberately do NOT run `prisma migrate` here: the pgvector / custom-generator schema breaks
 * `prisma migrate diff`, and the local Node is newer than the repo's supported range for the migrate
 * engine. A schema-only dump+restore is exact and engine-agnostic. Container/db names are overridable
 * via env so CI can point at its own services.
 */
// These overrides are interpolated into shell commands below, so validate them — a hostile value
// (e.g. TEST_DB_CONTAINER="x; rm -rf /") must not be able to inject commands. Container/db names are
// alphanumerics + _ . - ; the Redis DB index is digits. Anything else aborts the harness loudly.
const safeEnv = (value: string, pattern: RegExp, name: string): string => {
  if (!pattern.test(value)) {
    throw new Error(`Unsafe ${name} for the integration harness: ${JSON.stringify(value)}`);
  }
  return value;
};
const NAME_PATTERN = /^[A-Za-z0-9_.-]+$/;
const CONTAINER = safeEnv(
  process.env.TEST_DB_CONTAINER ?? "formbricks-postgres-1",
  NAME_PATTERN,
  "TEST_DB_CONTAINER"
);
const SOURCE_DB = safeEnv(process.env.TEST_DB_SOURCE ?? "formbricks", NAME_PATTERN, "TEST_DB_SOURCE");
const TEST_DB = safeEnv(process.env.TEST_DB_NAME ?? "formbricks_ba_test", NAME_PATTERN, "TEST_DB_NAME");
const REDIS_CONTAINER = safeEnv(
  process.env.TEST_REDIS_CONTAINER ?? "formbricks-valkey-1",
  NAME_PATTERN,
  "TEST_REDIS_CONTAINER"
);
const REDIS_TEST_DB = safeEnv(process.env.TEST_REDIS_DB ?? "15", /^\d+$/, "TEST_REDIS_DB");

const sh = (cmd: string): string => execSync(cmd, { stdio: "pipe" }).toString();

export default function setup(): void {
  // CI provisions formbricks_ba_test out-of-band (the workflow creates the DB, runs the migrations,
  // and applies the two ALTERs below) because GitHub Actions service containers aren't reachable via
  // `docker exec`. When that's already done, skip the docker-based clone + redis flush; per-test
  // isolation still comes from resetDb (TRUNCATE), and a fresh CI Valkey starts empty. Local dev (flag
  // unset) is unchanged.
  if (process.env.TEST_DB_PROVISIONED === "1") return;

  const adminPsql = (sql: string) =>
    sh(`docker exec ${CONTAINER} psql -U postgres -q -c ${JSON.stringify(sql)}`);
  const testPsql = (sql: string) =>
    sh(`docker exec ${CONTAINER} psql -U postgres -q -d ${TEST_DB} -c ${JSON.stringify(sql)}`);

  adminPsql(`DROP DATABASE IF EXISTS ${TEST_DB} WITH (FORCE);`);
  adminPsql(`CREATE DATABASE ${TEST_DB};`);
  // Dump to a file then restore (instead of piping) so BOTH a pg_dump failure (via &&) and a restore
  // SQL error (via ON_ERROR_STOP) abort loudly — a pipe would swallow a left-side failure, and the
  // container's `sh` (dash) has no `pipefail`. Without this a half-provisioned DB silently passes.
  sh(
    `docker exec ${CONTAINER} sh -c ${JSON.stringify(
      `pg_dump -U postgres --schema-only --no-owner --no-privileges ${SOURCE_DB} > /tmp/ba_test_schema.sql && ` +
        `psql -U postgres -q -v ON_ERROR_STOP=1 -d ${TEST_DB} -f /tmp/ba_test_schema.sql`
    )}`
  );
  testPsql(
    `ALTER TABLE "User" ALTER COLUMN email_verified DROP DEFAULT;` +
      `ALTER TABLE "User" ALTER COLUMN email_verified TYPE boolean USING (email_verified IS NOT NULL);` +
      `ALTER TABLE "User" ALTER COLUMN email_verified SET DEFAULT false;` +
      `ALTER TABLE "User" ALTER COLUMN email_verified SET NOT NULL;` +
      `ALTER TABLE "Account" ALTER COLUMN type DROP NOT NULL;`
  );

  // Isolate Better Auth's Redis secondary storage (db 15) from the dev cache (db 0).
  try {
    sh(`docker exec ${REDIS_CONTAINER} redis-cli -n ${REDIS_TEST_DB} flushdb`);
  } catch {
    // redis-cli may be unavailable under that container name; the DB-backed assertions don't need it.
  }
}
