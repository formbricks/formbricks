import "server-only";
import { logger } from "@formbricks/logger";
import { loggableError } from "@/lib/utils/loggable-error";
import { isAuthzedEnabled } from "./config";
import { drainAuthzedOutbox } from "./outbox-processor";
import { AUTHZED_OUTBOX_REVOCATION_WARNING_MS, hasUnclaimedAuthzedOutboxEvent } from "./outbox-repository";

/**
 * How often each jobs process asks PostgreSQL whether delivery has stalled.
 *
 * With the threshold below, a revocation the delivery job never picks up is delivered within 25
 * seconds of becoming claimable — inside the 60-second freshness guard, so a stalled job no longer
 * means a fail-closed outage. The probe is one `EXISTS` over the undelivered rows, per process.
 */
export const AUTHZED_OUTBOX_SAFETY_NET_INTERVAL_MS = 10_000;

/**
 * How long an event may sit claimable before the safety net takes it.
 *
 * Three cycles of the five-second delivery job, and the warning threshold the alerts already use: a
 * healthy job never leaves an event this long, so the safety net stays idle and the job's drain
 * heartbeat keeps meaning "the job is running".
 */
export const AUTHZED_OUTBOX_SAFETY_NET_UNCLAIMED_MS = AUTHZED_OUTBOX_REVOCATION_WARNING_MS;

/** Matches the delivery job, so one safety-net tick is never a longer burst than one job run. */
const AUTHZED_OUTBOX_SAFETY_NET_MAX_BATCHES = 10;

type TSafetyNetState = {
  running: Promise<void> | null;
  shouldRun: () => boolean;
  timer: ReturnType<typeof setInterval>;
};

// On globalThis so a module instantiated twice (dev reloads, separate server bundles) keeps one timer.
const globalForSafetyNet = globalThis as typeof globalThis & {
  formbricksAuthzedOutboxSafetyNet?: TSafetyNetState;
};

/**
 * Deliver the outbox from PostgreSQL alone when the BullMQ delivery job has stopped claiming it.
 *
 * The job is woken through Redis, and a worker can stay silently parked after a Redis reconnect
 * (bullmq#4479). The events are durable in PostgreSQL, so nothing about recovering them needs Redis.
 * Running on every replica alongside the job is safe: claims take `FOR UPDATE SKIP LOCKED` leases, so
 * no event is delivered twice and none is lost. Dead letters are never claimed, so a genuine
 * PostgreSQL/SpiceDB disagreement keeps the freshness guard armed; a failing SpiceDB backs events off
 * exactly as the job would.
 *
 * @param shouldRun re-checked after the probe, so a server that began draining while it was in flight
 * does not start a drain during shutdown.
 */
export const runAuthzedOutboxSafetyNet = async (shouldRun: () => boolean = () => true): Promise<void> => {
  if (!isAuthzedEnabled()) return;

  try {
    if (!(await hasUnclaimedAuthzedOutboxEvent(AUTHZED_OUTBOX_SAFETY_NET_UNCLAIMED_MS))) return;
    if (!shouldRun()) return;

    const result = await drainAuthzedOutbox(AUTHZED_OUTBOX_SAFETY_NET_MAX_BATCHES);
    // Warn on every take-over: a healthy job never leaves work this long, so each line means the job is
    // stalled or behind. Counts only — never an event, target, or tenant identifier.
    logger.warn(
      {
        claimed: result.claimed,
        component: "authzed",
        deadLettered: result.deadLettered,
        delivered: result.delivered,
        failed: result.failed,
        operation: "projection_outbox_safety_net",
        remaining: result.remaining,
      },
      "AuthZed projection outbox delivered by the safety net; the BullMQ delivery job is not keeping up"
    );
  } catch (error) {
    // PostgreSQL itself is down, or SpiceDB failed in a way the drain did not absorb. The next tick
    // retries; the freshness guard keeps denying meanwhile.
    logger.error(
      { component: "authzed", ...loggableError(error), operation: "projection_outbox_safety_net" },
      "AuthZed projection outbox safety net failed"
    );
  }
};

const tick = (state: TSafetyNetState): void => {
  // A slow drain must not stack ticks behind it.
  if (state.running || !state.shouldRun()) return;
  state.running = runAuthzedOutboxSafetyNet(state.shouldRun).finally(() => {
    state.running = null;
  });
};

/**
 * Start the safety net in a process that runs jobs. Idempotent, so a retried worker startup does not
 * add a second timer. Deliberately independent of Redis: it must keep running while the job is not.
 *
 * @param shouldRun checked on every tick, so a draining server stops taking new work.
 */
export const startAuthzedOutboxSafetyNet = (shouldRun: () => boolean = () => true): void => {
  if (globalForSafetyNet.formbricksAuthzedOutboxSafetyNet) return;

  const state: TSafetyNetState = {
    running: null,
    shouldRun,
    timer: setInterval(() => tick(state), AUTHZED_OUTBOX_SAFETY_NET_INTERVAL_MS),
  };
  // Never what keeps a process alive on shutdown.
  state.timer.unref();
  globalForSafetyNet.formbricksAuthzedOutboxSafetyNet = state;
};

/** Stop the timer and wait out a drain already in progress. */
export const stopAuthzedOutboxSafetyNet = async (): Promise<void> => {
  const state = globalForSafetyNet.formbricksAuthzedOutboxSafetyNet;
  if (!state) return;
  globalForSafetyNet.formbricksAuthzedOutboxSafetyNet = undefined;
  clearInterval(state.timer);
  await state.running;
};
