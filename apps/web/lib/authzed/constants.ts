import "server-only";

export const AUTHZED_REQUEST_TIMEOUT_MS = 1_000;
export const AUTHZED_MAX_ATTEMPTS = 3;
export const AUTHZED_RETRY_BASE_DELAYS_MS = [100, 200] as const;
export const AUTHZED_RETRY_JITTER_RATIO = 0.2;
export const AUTHZED_MAX_RELATIONSHIP_UPDATES = 1_000;
export const AUTHZED_MAX_PARALLEL_RELATIONSHIP_DELETES = 10;

/**
 * Deadline for administrative calls: bulk reads and wide deletes.
 *
 * The request-path deadline is sized for a single cheap call. A server-streaming read or an unbounded
 * delete needs room, and SpiceDB's own `--streaming-api-response-delay-timeout` defaults to 30s, so
 * matching it is the conservative choice. Applied by giving the command-line client its own channel;
 * the request-path client keeps `AUTHZED_REQUEST_TIMEOUT_MS`.
 */
export const AUTHZED_BULK_REQUEST_TIMEOUT_MS = 30_000;

/**
 * Relationships requested per `readRelationships` page.
 *
 * The deadline interceptor bounds the *entire* server-streaming call — the promisified SDK buffers
 * every message before resolving — so a page must fully stream within it. 250 leaves generous headroom
 * even on the request-path deadline, and stays well under SpiceDB's own
 * `--max-read-relationships-limit` (1,000 by default), which rejects a larger limit outright.
 */
export const AUTHZED_MAX_RELATIONSHIP_READS = 250;

/**
 * Resources requested per `LookupResources` page.
 *
 * The promise SDK buffers a server stream before resolving, so an unlimited request can consume
 * unbounded memory and run through the channel deadline. Paging at the same conservative size as raw
 * relationship reads keeps each individual allocation and retry bounded.
 */
export const AUTHZED_RESOURCE_LOOKUP_PAGE_SIZE = 250;

/**
 * Resource IDs accumulated by one complete permission lookup.
 *
 * Authoritative resource discovery must return complete sets. Crossing this guard fails the protected
 * operation closed instead of returning a partial authorization result or allowing a pathological
 * relationship graph to exhaust the process.
 */
export const AUTHZED_MAX_RESOURCE_LOOKUP_RESULTS = 20_000;

/**
 * Observed relationships held in memory for a single backfill unit before the unit is abandoned.
 *
 * Bounds the drainer so a pathological store cannot exhaust the process. This is a *per-unit* bound and
 * only applies to filters narrow enough to drain — one organization's resources, say. A sweep across a
 * whole resource type must stream instead (`forEachRelationshipPage`), because applying this bound there
 * would make the sweep fail outright on any deployment holding more relationships than the bound.
 */
export const AUTHZED_MAX_OBSERVED_RELATIONSHIPS_PER_UNIT = 20_000;

/** Organizations fetched per keyset page while enumerating backfill units. */
export const AUTHZED_BACKFILL_ORGANIZATION_PAGE_SIZE = 100;

/**
 * Projection targets handed to a reconciler in one call.
 *
 * Reconcilers read their source snapshot with `where: { OR: targets.map(...) }`, which is unbounded
 * by construction — a large tenant would build a query that is both a planner disaster and close to
 * PostgreSQL's bound-parameter ceiling. 200 targets also keeps the widest fan-out (4 updates per
 * membership) under `AUTHZED_MAX_RELATIONSHIP_UPDATES`.
 */
export const AUTHZED_BACKFILL_TARGET_CHUNK_SIZE = 200;

/**
 * Orphaned resources a single run may prune.
 *
 * A large orphan count is a symptom — wrong endpoint, wrong database, a mid-restore SpiceDB — not a
 * big cleanup job. Exceeding the cap prunes nothing for that unit so the run degrades into a loud
 * report instead of a partly-destroyed authorization graph. Operators may lower it, never raise it.
 *
 * "Nothing" is the whole point, and it is why every unit — the streaming sweep included — counts its
 * orphans to completion before deleting any of them. A cap enforced per page would let the pages that
 * fit through and halt on the one that did not, leaving the graph partly destroyed by exactly the
 * mistake the cap exists to catch.
 */
export const AUTHZED_MAX_PRUNED_RESOURCES_PER_RUN = 500;

/**
 * Distinct orphaned records the global sweep tracks to keep its count exact.
 *
 * The sweep streams, so one record can be implied by relationships on more than one page: a user who
 * holds both `member` and `owner` is two tuples, and SpiceDB returns them grouped by relation rather
 * than adjacently, so they straddle a page boundary in any organization larger than a page. Counting
 * that record twice would inflate the total, and the total is the diagnostic.
 *
 * Bounded because this set is the one structure in a streaming sweep that grows with the store. Past the
 * bound the sweep keeps counting and reports `truncated`: a total that may double-count is far better
 * than an unbounded heap, and a run with this many orphans is already three orders of magnitude past the
 * prune cap, so nothing is deleted on the strength of it.
 */
export const AUTHZED_MAX_TRACKED_ORPHAN_REFS = 50_000;
