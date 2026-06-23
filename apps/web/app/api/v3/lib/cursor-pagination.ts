import "server-only";
import { InvalidInputError } from "@formbricks/types/errors";

/** Default/max page size for v3 reference-collection list endpoints (action classes, attribute keys). */
export const V3_LIST_DEFAULT_LIMIT = 50;
export const V3_LIST_MAX_LIMIT = 100;

const encodeIdCursor = (id: string): string => Buffer.from(id, "utf8").toString("base64url");

/**
 * Decode an opaque cursor back to the id it was issued for. `Buffer.from(…, "base64url")` is lenient
 * (it never throws — it silently drops invalid characters), so a malformed cursor would otherwise
 * decode to garbage and return a wrong or empty page. Guard with a canonical round-trip check and
 * reject anything we could not have issued, so the caller can surface a 400 (matching the survey-list
 * cursor contract) instead of silently hiding data behind a 200.
 */
const decodeIdCursor = (cursor: string): string => {
  try {
    const decoded = Buffer.from(cursor, "base64url").toString("utf8");
    if (decoded.length === 0 || encodeIdCursor(decoded) !== cursor) {
      throw new InvalidInputError("Invalid pagination cursor");
    }
    return decoded;
  } catch (error) {
    // Any failure decoding or round-tripping a client-supplied cursor is a bad cursor, not a server
    // fault — always surface it as InvalidInputError (→ 400) rather than letting an unexpected throw
    // escape as a 500.
    throw error instanceof InvalidInputError ? error : new InvalidInputError("Invalid pagination cursor");
  }
};

/**
 * Stable, in-memory cursor pagination over a fully-fetched collection.
 *
 * Items are ordered by their `id` (cuid2 — unique and stable) and the opaque cursor encodes the last
 * returned id, so paging stays correct across insertions/deletions between requests (it filters by
 * `id > cursor` rather than by offset, so a deleted cursor row doesn't shift or duplicate a page).
 *
 * This is intended for **bounded reference collections** that the codebase already reads as a whole
 * (request-deduped via React cache, not a persistent cache) — e.g. a workspace's action classes or
 * contact-attribute keys. It bounds the response
 * payload and yields the standard `{ data, meta: { nextCursor } }` contract without forking the
 * canonical read query. Large or unbounded collections (surveys, responses, …) should instead
 * paginate at the database with a `take`/`cursor` query.
 */
export function paginateByIdCursor<T extends { id: string }>(
  items: readonly T[],
  options: { limit: number; cursor?: string }
): { page: T[]; nextCursor: string | null } {
  const ordered = [...items].sort((a, b) => a.id.localeCompare(b.id));
  const afterId = options.cursor ? decodeIdCursor(options.cursor) : null;
  const remaining = afterId ? ordered.filter((item) => item.id.localeCompare(afterId) > 0) : ordered;
  const page = remaining.slice(0, options.limit);
  const lastItem = page.at(-1);
  const nextCursor = remaining.length > options.limit && lastItem ? encodeIdCursor(lastItem.id) : null;
  return { page, nextCursor };
}
