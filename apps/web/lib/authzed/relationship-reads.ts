import "server-only";
import type {
  TAuthzedClient,
  TAuthzedReadCursor,
  TAuthzedRelationship,
  TAuthzedRelationshipReadFilter,
  TAuthzedSnapshot,
} from "./client";
import { AUTHZED_MAX_OBSERVED_RELATIONSHIPS_PER_UNIT, AUTHZED_MAX_RELATIONSHIP_READS } from "./constants";
import { AUTHZED_ERROR_CODES, AuthzedError } from "./errors";

/**
 * Pagination over the facade's single-page relationship read, kept outside the frozen facade for the
 * same reason relationship batching is: the facade stays a transport boundary and the looping,
 * bounding, and revision-pinning policy lives here where it can evolve.
 *
 * Reads are for reconciling SpiceDB against PostgreSQL. They must never back a permission decision —
 * see the note on `TAuthzedClient.readRelationships`.
 */

/**
 * Assert the cursor advanced.
 *
 * Termination is not ours to guarantee — it depends on the server — so assert it rather than assume it.
 * A command that hangs with no output and no exit code is the worst thing to hand an operator, and the
 * accumulation bound in `readAllRelationships` cannot stand in for this: a stalled cursor returning
 * empty pages never grows the accumulator, so that loop would spin forever rather than trip its cap.
 */
const assertCursorAdvanced = (
  previous: TAuthzedReadCursor | undefined,
  next: TAuthzedReadCursor | null,
  operation: string
): void => {
  if (previous !== undefined && next?.token === previous.token) {
    throw new AuthzedError({
      attempts: 0,
      code: AUTHZED_ERROR_CODES.INTERNAL,
      operation,
      retryable: false,
    });
  }
};

/**
 * Assert every page describes the same revision.
 *
 * The cursor is supposed to hold the revision steady. Verifying it turns a silent torn read — the
 * failure that would make a pruning caller delete live relationships — into a loud one.
 */
const assertSameRevision = (
  snapshot: TAuthzedSnapshot | null,
  pageSnapshot: TAuthzedSnapshot | null,
  operation: string
): void => {
  if (snapshot !== null && pageSnapshot !== null && pageSnapshot.token !== snapshot.token) {
    throw new AuthzedError({
      attempts: 0,
      code: AUTHZED_ERROR_CODES.ABORTED,
      operation,
      retryable: true,
    });
  }
};

/**
 * A complete observation of every relationship matching a filter, at one revision.
 *
 * There is deliberately no "partial" or "truncated" variant. A reconciler that mistook a partial
 * observation for a complete one would conclude that the relationships it failed to read do not
 * exist — and, when pruning, delete live access. So an incomplete drain is not representable here:
 * `readAllRelationships` either returns every matching relationship or throws.
 */
export type TAuthzedRelationshipObservation = Readonly<{
  relationships: ReadonlyArray<TAuthzedRelationship>;
  /**
   * The revision every page was read at, or `null` when nothing matched the filter (SpiceDB reports
   * no revision for an empty result).
   */
  snapshot: TAuthzedSnapshot | null;
}>;

/**
 * Stream every relationship matching `filter`, one page at a time.
 *
 * Use this rather than `readAllRelationships` whenever the match is unbounded — a whole resource type,
 * say. Accumulating those would hold the entire store in memory and trip the per-unit bound, which for a
 * deployment with more relationships than that bound would make the sweep fail outright rather than
 * merely slow.
 *
 * Consistency behaves exactly as below: identical parameters on every page, the cursor carries the
 * revision, and a page reporting a different revision aborts rather than silently mixing two views.
 * `onPage` failures propagate, so a caller cannot mistake a partial stream for a complete one.
 *
 * Returns the revision the stream was read at, or `null` if nothing matched.
 */
export const forEachRelationshipPage = async (
  client: Pick<TAuthzedClient, "readRelationships">,
  filter: TAuthzedRelationshipReadFilter,
  onPage: (relationships: ReadonlyArray<TAuthzedRelationship>) => Promise<void>
): Promise<TAuthzedSnapshot | null> => {
  let snapshot: TAuthzedSnapshot | null = null;
  let cursor: TAuthzedReadCursor | undefined;

  do {
    const page = await client.readRelationships({
      ...(cursor ? { cursor } : {}),
      filter,
      limit: AUTHZED_MAX_RELATIONSHIP_READS,
    });

    assertSameRevision(snapshot, page.snapshot, "for_each_relationship_page");
    assertCursorAdvanced(cursor, page.cursor, "for_each_relationship_page");

    snapshot = page.snapshot ?? snapshot;
    cursor = page.cursor ?? undefined;

    if (page.relationships.length > 0) {
      await onPage(page.relationships);
    }
  } while (cursor);

  return snapshot;
};

/**
 * Read every relationship matching `filter`, at a single consistent revision.
 *
 * Only for filters narrow enough to hold in memory — one resource, typically. For an unbounded filter
 * use `forEachRelationshipPage`.
 *
 * Every page is requested with identical parameters and the cursor carries the revision it was issued
 * at, so the pages of one drain describe one view. SpiceDB enforces the identical-parameters rule by
 * rejecting a cursor presented with any other argument changed — which is why nothing here varies the
 * consistency requirement between pages.
 *
 * Throws rather than returning a partial result when:
 *
 * - the match exceeds `AUTHZED_MAX_OBSERVED_RELATIONSHIPS_PER_UNIT` (`authzed_limit_exceeded`), which
 *   also bounds the loop, since every continued iteration must have consumed a full page;
 * - a later page reports a different revision than the first, meaning the pages do not describe one
 *   view and the observation is torn;
 * - any page fails for the usual operational reasons.
 *
 * Callers are expected to treat a throw as "this unit could not be observed" and continue with other
 * units, never as "this unit has no relationships".
 */
export const readAllRelationships = async (
  client: Pick<TAuthzedClient, "readRelationships">,
  filter: TAuthzedRelationshipReadFilter
): Promise<TAuthzedRelationshipObservation> => {
  const relationships: TAuthzedRelationship[] = [];
  let snapshot: TAuthzedSnapshot | null = null;
  let cursor: TAuthzedReadCursor | undefined;

  do {
    const page = await client.readRelationships({
      ...(cursor ? { cursor } : {}),
      filter,
      limit: AUTHZED_MAX_RELATIONSHIP_READS,
    });

    if (relationships.length + page.relationships.length > AUTHZED_MAX_OBSERVED_RELATIONSHIPS_PER_UNIT) {
      throw new AuthzedError({
        attempts: 0,
        code: AUTHZED_ERROR_CODES.LIMIT_EXCEEDED,
        operation: "read_all_relationships",
        retryable: false,
      });
    }

    assertSameRevision(snapshot, page.snapshot, "read_all_relationships");
    assertCursorAdvanced(cursor, page.cursor, "read_all_relationships");

    relationships.push(...page.relationships);
    snapshot = page.snapshot ?? snapshot;
    cursor = page.cursor ?? undefined;
  } while (cursor);

  return { relationships, snapshot };
};
