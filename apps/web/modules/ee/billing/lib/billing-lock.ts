import "server-only";
import { randomUUID } from "node:crypto";
import { createCacheKey } from "@formbricks/cache";
import { logger } from "@formbricks/logger";
import { cache } from "@/lib/cache";

/**
 * One lock per organization around everything that writes its billing from Stripe: the read-through
 * refresh (`getOrganizationBillingWithReadThroughSync`), an explicit sync, and a plan change. It is the
 * read-through's single-flight `billingSyncLock` (a Redis `SET NX PX`), so two syncs can't interleave and
 * write an older Stripe snapshot last, and two plan changes can't race each other or a sync.
 *
 * Each holder writes its own token and gives the lock back when done; the TTL only covers a holder that
 * died. A holder that runs past its TTL can lose the lock to the next one, which then runs beside it, as
 * the read-through always could.
 */

/** A sync: a few Stripe reads and one write. The read-through's lock TTL. */
export const BILLING_SYNC_LOCK_TTL_MS = 30 * 1000;

/** A plan change: several Stripe writes, then a sync. */
export const BILLING_CHANGE_LOCK_TTL_MS = 2 * 60 * 1000;

/**
 * How long a plan change waits for the lock before answering that one is already running: long enough to
 * outlast a read-through refresh that a page render started a moment earlier.
 */
export const BILLING_CHANGE_LOCK_WAIT_MS = 10 * 1000;

const LOCK_RETRY_INTERVAL_MS = 250;

/** Deletes the lock only while it still holds this holder's token, so an expired holder can't free the next. */
const RELEASE_SCRIPT = `
  if redis.call('GET', KEYS[1]) == ARGV[1] then
    return redis.call('DEL', KEYS[1])
  end
  return 0
`;

export type TBillingLockAcquisition =
  /** This caller holds the lock; `release` gives it back. */
  | { status: "acquired"; release: () => Promise<void> }
  /** Another caller held it for the whole wait. */
  | { status: "busy" }
  /** Redis did not answer, so no lock can be had either way. */
  | { status: "unavailable" };

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const releaseLock = async (key: string, token: string, organizationId: string): Promise<void> => {
  try {
    await cache.runRedisOperation((redis) => redis.eval(RELEASE_SCRIPT, { keys: [key], arguments: [token] }));
  } catch (error) {
    // The TTL frees it anyway.
    logger.warn({ error, organizationId }, "Could not release the organization billing lock");
  }
};

/** Take the organization's billing lock, retrying until `waitMs` has passed. */
export const acquireOrganizationBillingLock = async (
  organizationId: string,
  { ttlMs, waitMs = 0 }: { ttlMs: number; waitMs?: number }
): Promise<TBillingLockAcquisition> => {
  const key = createCacheKey.organization.billingSyncLock(organizationId);
  const token = randomUUID();
  const deadline = Date.now() + waitMs;

  for (;;) {
    const result = await cache.tryLock(key, token, ttlMs);
    if (!result.ok) return { status: "unavailable" };
    if (result.data) return { status: "acquired", release: () => releaseLock(key, token, organizationId) };

    const remainingMs = deadline - Date.now();
    if (remainingMs <= 0) return { status: "busy" };
    await sleep(Math.min(LOCK_RETRY_INTERVAL_MS, remainingMs));
  }
};

/**
 * Run `work` holding the organization's billing lock. `{ ran: false }` when another holder kept it for the
 * whole wait. Without Redis it runs unlocked rather than not at all, as the throughput limits do
 * (docs/adr/0016-abuse-limits-fail-closed.md): a Redis blip must not stop every plan change. It logs that
 * it did.
 */
export const withOrganizationBillingLock = async <T>(
  organizationId: string,
  work: () => Promise<T>,
  options: { ttlMs: number; waitMs?: number }
): Promise<{ ran: true; value: T } | { ran: false }> => {
  const lock = await acquireOrganizationBillingLock(organizationId, options);
  if (lock.status === "busy") return { ran: false };
  if (lock.status === "unavailable") {
    logger.warn({ organizationId }, "Organization billing lock unavailable; running without it");
    return { ran: true, value: await work() };
  }

  try {
    return { ran: true, value: await work() };
  } finally {
    await lock.release();
  }
};
