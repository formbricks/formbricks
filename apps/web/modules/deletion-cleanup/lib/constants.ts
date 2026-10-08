/**
 * Timing and budgets for draining `DeletionCleanup` (ENG-3612). The drain runs on the shared job worker,
 * whose default concurrency is one, so a run is kept short: anything left over waits for the next tick
 * rather than holding up response processing.
 */

/** How often the drain job runs. */
export const DELETION_CLEANUP_DRAIN_INTERVAL_MS = 5 * 60 * 1000;

/**
 * How long a survey's Hub cleanup waits after the delete, and after any pass that still found records.
 * A response being sent to the Hub when its survey was deleted can land a record moments later, so the
 * row is done only once a pass this long after the last deletion finds nothing.
 */
export const HUB_CLEANUP_SETTLE_MS = 5 * 60 * 1000;

/**
 * A claimed row is hidden from other drains for this long. Far longer than a run's time budget, so a row
 * is only picked up twice if its worker died, and every step is idempotent if that happens.
 */
export const DELETION_CLEANUP_LEASE_SECONDS = 15 * 60;

/** Rows claimed per round trip. */
export const DELETION_CLEANUP_CLAIM_BATCH = 10;

/** A drain stops claiming once this much time has passed; a row in progress finishes its current call. */
export const DELETION_CLEANUP_RUN_BUDGET_MS = 60 * 1000;

/** Hub calls (lists and deletes) one drain may make, across all its rows. */
export const DELETION_CLEANUP_HUB_CALL_BUDGET = 5000;

/** Hub records listed, then deleted, per page. */
export const HUB_CLEANUP_PAGE_SIZE = 100;

/** Hub deletes in flight at once. */
export const HUB_CLEANUP_CONCURRENCY = 8;

/** Named storage files per `storageFiles` row, and so per call to storage at once. */
export const STORAGE_CLEANUP_CHUNK_SIZE = 100;

const RETRY_BASE_MS = 60 * 1000;
const RETRY_MAX_MS = 24 * 60 * 60 * 1000;

/**
 * The wait before retrying a row that has failed `attempts` times in a row: a minute, doubling, capped at
 * a day. A row is never given up on: whatever it names is data that must go.
 */
export const getDeletionCleanupRetryDelayMs = (attempts: number): number =>
  Math.min(RETRY_BASE_MS * 2 ** Math.max(0, Math.min(attempts - 1, 20)), RETRY_MAX_MS);
