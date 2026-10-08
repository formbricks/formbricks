import { env } from "@/lib/env";

/**
 * Daily at 01:00, in the same time zone as survey scheduling (00:00 by default) and the archive purge
 * (01:30): after the night's scheduling, before the purge.
 */
export const DATA_RETENTION_SWEEP_TIME_ZONE = env.SURVEY_SCHEDULING_TIME_ZONE;
export const DATA_RETENTION_SWEEP_DAILY_CRON_PATTERN = "0 1 * * *";

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

/**
 * A policy whose last run is older than this, and whose warning hasn't restarted since, starts its
 * warning again before it acts (ENG-3614): an organisation coming back after a lapsed licence, or a
 * sweep that hasn't run for days, must not act that night on a backlog nobody was warned about. Three
 * nights, so one missed tick (a deploy dropping it, a licence lookup failing once, a DST jump past
 * 01:00, a night the sweep's budget deferred the organisation) never restarts it: a restart voids every
 * notice and emails everyone again.
 */
export const RETENTION_SWEEP_GAP_MS = 72 * HOUR;

/**
 * A run with no `finishedAt` holds its policy for this long, so a second sweep (another replica, an
 * overlapping tick) skips it. Far longer than a run's budget; a run that died is released after it.
 */
export const RETENTION_RUN_LEASE_MS = 2 * HOUR;

/**
 * How long one policy's run may keep starting work. The job shares a worker that defaults to one job at
 * a time, so the rest waits for the next night (candidates are always `<=`, so nothing is missed).
 */
export const RETENTION_RUN_BUDGET_MS = 2 * MINUTE;

/** How long one night's sweep may keep starting organisations; the least recently swept go first. */
export const RETENTION_SWEEP_BUDGET_MS = 30 * MINUTE;

/** Each sweep transaction: Postgres cancels a statement after this, Prisma the transaction after these. */
export const RETENTION_SWEEP_STATEMENT_TIMEOUT_MS = 30_000;
export const RETENTION_SWEEP_TRANSACTION_TIMEOUT_MS = 60_000;
export const RETENTION_SWEEP_TRANSACTION_MAX_WAIT_MS = 10_000;

/** Targets read per candidate query, and claimed per notice transaction. */
export const RETENTION_SWEEP_BATCH_SIZE = 100;

/**
 * Notices one policy's run sends at most. A first night with a large backlog warns the rest on the
 * following nights; nothing acts on a target before its own notice has run in full.
 */
export const RETENTION_NOTICES_PER_RUN = 500;

/** Targets one policy's run acts on at most; the rest wait for the next night. */
export const RETENTION_ACTIONS_PER_RUN = 2000;

/** Survey read checks (SpiceDB bulk calls) in flight at once while choosing notice recipients. */
export const RETENTION_RECIPIENT_CHECK_CONCURRENCY = 4;
