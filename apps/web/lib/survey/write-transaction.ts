import "server-only";
import { prisma } from "@formbricks/database";
import type { Prisma } from "@formbricks/database/prisma";

/**
 * Interactive-transaction options for a survey write. The write rewrites blocks and languages and
 * reconciles the Embedded Data rows (a read plus up to two writes per field, neither bounded), then
 * reads the survey back through `selectSurvey`'s deep select — enough to approach Prisma's 5s default
 * on a large survey.
 */
export const SURVEY_WRITE_TRANSACTION_OPTIONS = { timeout: 20_000, maxWait: 10_000 } as const;

/**
 * A transaction a caller opened around one or more survey writes (survey create, v3 create, v3 patch),
 * so the survey lands together with the caller's own writes or not at all — an import creates the
 * survey's references (action classes, attribute keys, shared fields) and the survey atomically.
 *
 * Passed to a write, it changes two things and nothing else:
 *
 * - every write the operation makes goes through `tx`, and so does every read of a Reference the
 *   caller may have created in it (languages, action classes, attribute keys, shared fields), so the
 *   operation sees what the caller already wrote and rolls back with it. Reads of things an import
 *   never creates (the organization, creatives, segments and surveys a filter names, the survey cap)
 *   stay on their usual cached readers;
 * - the work the operation would otherwise run after its own commit (scheduling reconciliation, the
 *   creator's response-alert subscription, cache invalidation, feedback-source reconciliation) is
 *   handed to `afterCommit` instead, because before the caller commits there is nothing durable for
 *   it to act on, and after a rollback there must be nothing at all.
 *
 * The survey a write returns under a caller transaction is the one its transaction wrote: a schedule
 * that falls due is reconciled after the commit, not reflected in that result.
 *
 * Open one with {@link runInSurveyWriteTransaction}, which runs the registered work once the
 * transaction commits.
 */
export type TSurveyWriteTransaction = Readonly<{
  tx: Prisma.TransactionClient;
  afterCommit: (effect: () => Promise<unknown>) => void;
}>;

/**
 * The work registered with `afterCommit` failed, after the write itself had committed: `result` is what
 * the write returned, and `cause` what the work threw. A caller must not answer this as "nothing was
 * written", nor give back what it reserved for the write (an idempotency key): the data is there.
 */
export class SurveyWriteAfterCommitError<T = unknown> extends Error {
  readonly result: T;

  constructor(result: T, cause: unknown) {
    super("The survey write committed, but the work after its commit failed", { cause });
    this.name = "SurveyWriteAfterCommitError";
    this.result = result;
  }
}

/**
 * Run `write` in one interactive transaction and, only once it has committed, the work the survey
 * writes inside it registered with `afterCommit`, in registration order — the order those writes would
 * have run it in on their own. A throw from `write` rolls everything back and runs none of it.
 *
 * Every effect runs, even after one fails: each is independent work on data that has committed (a
 * subscription, a cache, a schedule), and nothing retries a skipped one. Any failure then throws one
 * `SurveyWriteAfterCommitError` carrying the write's result — and the failure, or an `AggregateError` of
 * them — so the caller can tell it from a failed write.
 */
export const runInSurveyWriteTransaction = async <T>(
  write: (transaction: TSurveyWriteTransaction) => Promise<T>
): Promise<T> => {
  const afterCommitEffects: Array<() => Promise<unknown>> = [];

  const result = await prisma.$transaction(
    (tx) =>
      write({
        tx,
        afterCommit: (effect) => {
          afterCommitEffects.push(effect);
        },
      }),
    SURVEY_WRITE_TRANSACTION_OPTIONS
  );

  const failures: unknown[] = [];
  for (const effect of afterCommitEffects) {
    try {
      // In order, one at a time: each runs as the write would have run it on its own.
      await effect(); // NOSONAR(typescript:S9382) -- sequential on purpose
    } catch (error) {
      failures.push(error);
    }
  }
  if (failures.length === 1) throw new SurveyWriteAfterCommitError(result, failures[0]);
  if (failures.length > 1) {
    throw new SurveyWriteAfterCommitError(
      result,
      new AggregateError(failures, `${failures.length} after-commit effects failed`)
    );
  }

  return result;
};
