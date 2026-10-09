import "server-only";
import { prisma } from "@formbricks/database";
import type { Prisma, RetentionEntity, RetentionSurveyCondition } from "@formbricks/database/prisma";
import {
  RETENTION_SWEEP_STATEMENT_TIMEOUT_MS,
  RETENTION_SWEEP_TRANSACTION_MAX_WAIT_MS,
  RETENTION_SWEEP_TRANSACTION_TIMEOUT_MS,
} from "./constants";

/**
 * A sweep transaction: bounded by Prisma (`timeout`, `maxWait`) and by Postgres, which cancels any one
 * statement after `RETENTION_SWEEP_STATEMENT_TIMEOUT_MS`. `set_config(…, true)` scopes the timeout to
 * this transaction, the way `SET LOCAL` would; `SET LOCAL` itself can't take a bound parameter.
 */
export const runSweepTransaction = <T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> =>
  prisma.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT set_config('statement_timeout', ${String(RETENTION_SWEEP_STATEMENT_TIMEOUT_MS)}, true)`;
      return fn(tx);
    },
    { timeout: RETENTION_SWEEP_TRANSACTION_TIMEOUT_MS, maxWait: RETENTION_SWEEP_TRANSACTION_MAX_WAIT_MS }
  );

/** The policy as a run found it. Every action checks the policy still says this before it acts. */
export type TRetentionPolicySnapshot = {
  id: string;
  organizationId: string;
  entity: RetentionEntity;
  enabledAt: Date;
  warnDays: number;
  periodDays: number;
  conditions: RetentionSurveyCondition[];
};

/** The policy changed (paused, edited, its warning restarted) since the run read it: the run stops. */
export class RetentionPolicyChangedError extends Error {
  constructor(readonly entity: RetentionEntity) {
    super(`The ${entity} retention policy changed during the run.`);
    this.name = "RetentionPolicyChangedError";
  }
}

/** The same set of conditions, in any order. Both directions, so a repeated entry can't stand in for another. */
const sameConditions = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length &&
  a.every((condition) => b.includes(condition)) &&
  b.every((condition) => a.includes(condition));

/**
 * Hold the policy row `FOR SHARE` for the rest of the action's transaction and check it still matches the
 * run's snapshot. An edit takes the row `FOR UPDATE`, so it waits for an action in flight, and an action
 * after an edit sees the change and stops the run (ENG-3614: pausing takes effect immediately).
 */
export const lockUnchangedRetentionPolicy = async (
  tx: Prisma.TransactionClient,
  snapshot: TRetentionPolicySnapshot
): Promise<void> => {
  const [row] = await tx.$queryRaw<
    {
      enabled: boolean;
      enabledAt: Date | null;
      warnDays: number;
      periodDays: number;
      conditions: string[];
    }[]
  >`
    SELECT "enabled", "enabledAt", "warnDays", "periodDays", "conditions"::text[] AS "conditions"
    FROM "RetentionPolicy"
    WHERE "id" = ${snapshot.id}
    FOR SHARE
  `;
  const unchanged =
    row?.enabled === true &&
    row.enabledAt?.getTime() === snapshot.enabledAt.getTime() &&
    row.warnDays === snapshot.warnDays &&
    row.periodDays === snapshot.periodDays &&
    sameConditions(row.conditions, snapshot.conditions);
  if (!unchanged) throw new RetentionPolicyChangedError(snapshot.entity);
};

export { readDatabaseClock } from "../lib/database-clock";
