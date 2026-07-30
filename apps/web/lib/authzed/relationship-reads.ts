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
 * Read every relationship matching `filter`, at a single consistent revision.
 *
 * The first page resolves fully consistently and its revision pins every later page, so the result
 * is one coherent view rather than a stitched-together sequence of independently-resolved pages.
 *
 * Throws rather than returning a partial result when:
 *
 * - the match exceeds `AUTHZED_MAX_OBSERVED_RELATIONSHIPS_PER_UNIT` (`authzed_limit_exceeded`), which
 *   also bounds the loop, since every continued iteration must have consumed a full page;
 * - the pinned revision ages out of the datastore's garbage-collection window mid-drain, which
 *   SpiceDB reports as a snapshot-expired failure and the facade maps to a non-retryable error;
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
      // Absent on the first call so SpiceDB resolves the latest revision and hands it back.
      ...(snapshot ? { atSnapshot: snapshot } : {}),
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

    relationships.push(...page.relationships);
    snapshot = page.snapshot;
    cursor = page.cursor ?? undefined;
  } while (cursor);

  return { relationships, snapshot };
};
