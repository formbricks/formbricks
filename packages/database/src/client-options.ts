import { DEFAULT_POOL_ACQUIRE_TIMEOUT_MS, createPrismaPgAdapter } from "./prisma-adapter";

/**
 * Columns a read without a `select` must not return — passed as `omit` to every Prisma client that
 * stands in for the app's: the real one in `client.ts` and the integration harness's Boolean-shaped
 * one (apps/web/integration/db-boolean.ts), both through `createAppPrismaClientOptions` below. One
 * constant, so the two cannot drift.
 *
 * `Response.ingestFlags` is Embedded Data ingest bookkeeping (ENG-1845) with one reader — the response
 * update in apps/web/lib/response/service.ts — which selects it explicitly, and an explicit `select`
 * still returns an omitted column. Every other read is a consumer: without this, the v2 management
 * responses routes and the pipeline payload served an internal column that no OpenAPI bundle describes
 * (ENG-2955). Omitted at the client rather than per query so the next internal column is one line here,
 * not a hunt through every route that forgot a `select`.
 */
export const PRISMA_GLOBAL_OMIT = { response: { ingestFlags: true } } as const;

/**
 * Execution budget for the app client's `$transaction` calls, interactive and batch alike; a call that
 * passes its own `timeout` still wins. Prisma's own default is 5 s.
 *
 * Prisma's timeout cancels nothing on the server. When it fires, the ROLLBACK queues behind whatever
 * statement is still running, so the connection and its row locks stay held until that statement
 * finishes either way (ENG-3285). The budget therefore barely changes how long a slow transaction
 * occupies the pool — it decides whether the work it finished is kept or thrown away, and at 5 s it was
 * throwing away identify writes and response updates that were seconds from committing.
 */
export const APP_TRANSACTION_TIMEOUT_MS = 20_000;

/**
 * How much longer than pg-pool's own acquire timeout Prisma waits to *start* a transaction. Keeping
 * Prisma's `maxWait` the outer bound means a saturated pool fails with pg-pool's error, and a start is
 * never abandoned by Prisma while the pool is still about to hand it a connection.
 */
export const TRANSACTION_MAX_WAIT_HEADROOM_MS = 1_000;

/**
 * Server-side backstop for a transaction left open by a stalled process or a leaked connection: Postgres
 * ends the session and releases its locks. Nothing in the app idles inside a transaction for anywhere
 * near this long. App client only — migrations hold transactions open for minutes.
 */
export const APP_IDLE_IN_TRANSACTION_SESSION_TIMEOUT_MS = 60_000;

export const getAppTransactionOptions = (
  poolAcquireTimeoutMillis: number
): { maxWait: number; timeout: number } => ({
  // connect_timeout=0 turns pg-pool's acquire timeout off, and Prisma rejects maxWait <= 0, so fall back
  // to the default bound; Prisma is then the only limit on the wait, as it was before this existed.
  maxWait:
    (poolAcquireTimeoutMillis > 0 ? poolAcquireTimeoutMillis : DEFAULT_POOL_ACQUIRE_TIMEOUT_MS) +
    TRANSACTION_MAX_WAIT_HEADROOM_MS,
  timeout: APP_TRANSACTION_TIMEOUT_MS,
});

/**
 * Everything the app's PrismaClient is constructed with, shared with the integration harness so both
 * clients run with the same pool settings and transaction budgets.
 */
export const createAppPrismaClientOptions = (databaseUrl?: string) => {
  const { adapter, poolAcquireTimeoutMillis } = createPrismaPgAdapter(databaseUrl, {
    idleInTransactionSessionTimeoutMillis: APP_IDLE_IN_TRANSACTION_SESSION_TIMEOUT_MS,
  });

  return {
    adapter,
    omit: PRISMA_GLOBAL_OMIT,
    transactionOptions: getAppTransactionOptions(poolAcquireTimeoutMillis),
  };
};
