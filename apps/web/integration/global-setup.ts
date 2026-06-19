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
const CONTAINER = process.env.TEST_DB_CONTAINER ?? "formbricks-postgres-1";
const SOURCE_DB = process.env.TEST_DB_SOURCE ?? "formbricks";
const TEST_DB = process.env.TEST_DB_NAME ?? "formbricks_ba_test";
const REDIS_CONTAINER = process.env.TEST_REDIS_CONTAINER ?? "formbricks-valkey-1";
const REDIS_TEST_DB = process.env.TEST_REDIS_DB ?? "15";

const sh = (cmd: string): string => execSync(cmd, { stdio: "pipe" }).toString();

export default function setup(): void {
  const adminPsql = (sql: string) =>
    sh(`docker exec ${CONTAINER} psql -U postgres -q -c ${JSON.stringify(sql)}`);
  const testPsql = (sql: string) =>
    sh(`docker exec ${CONTAINER} psql -U postgres -q -d ${TEST_DB} -c ${JSON.stringify(sql)}`);

  adminPsql(`DROP DATABASE IF EXISTS ${TEST_DB} WITH (FORCE);`);
  adminPsql(`CREATE DATABASE ${TEST_DB};`);
  sh(
    `docker exec ${CONTAINER} sh -c ${JSON.stringify(
      `pg_dump -U postgres --schema-only --no-owner --no-privileges ${SOURCE_DB} | psql -U postgres -q ${TEST_DB}`
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
