import "server-only";
import { prisma } from "@formbricks/database";
import type { Prisma, RetentionEntity, RetentionSurveyCondition } from "@formbricks/database/prisma";
import { logger } from "@formbricks/logger";
import { sameConditions } from "../lib/policy-rules";
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

/**
 * Run one target's action so that its failure stays its own: logged, and the loop goes on to the next
 * target. Otherwise a target that fails every night (a batch that always times out, say) would stop its
 * policy's run there each time, and no target after it in id order would ever be acted on. A changed
 * policy still stops the whole run, as it must. The failure is reported to the run
 * (`onTargetFailure`), so a night of failed actions still counts as a failed run. Returns undefined when
 * the action failed.
 */
export const actOnTarget = async <T>(
  context: {
    policy: Pick<TRetentionPolicySnapshot, "organizationId" | "entity">;
    onTargetFailure?: () => void;
  },
  targetId: string,
  action: () => Promise<T>
): Promise<T | undefined> => {
  try {
    return await action();
  } catch (error) {
    if (error instanceof RetentionPolicyChangedError) throw error;
    logger.error(
      { err: error, organizationId: context.policy.organizationId, entity: context.policy.entity, targetId },
      "Data retention action failed for one target; the run goes on"
    );
    context.onTargetFailure?.();
    return undefined;
  }
};

export { readDatabaseClock } from "@/lib/utils/database-clock";
