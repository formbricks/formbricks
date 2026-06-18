import "server-only";

/** Default/max page size for v3 reference-collection list endpoints (action classes, attribute keys). */
export const V3_LIST_DEFAULT_LIMIT = 50;
export const V3_LIST_MAX_LIMIT = 100;

const encodeIdCursor = (id: string): string => Buffer.from(id, "utf8").toString("base64url");
const decodeIdCursor = (cursor: string): string => Buffer.from(cursor, "base64url").toString("utf8");

/**
 * Stable, in-memory cursor pagination over a fully-fetched collection.
 *
 * Items are ordered by their `id` (cuid2 — unique and stable) and the opaque cursor encodes the last
 * returned id, so paging stays correct across insertions/deletions between requests (it filters by
 * `id > cursor` rather than by offset, so a deleted cursor row doesn't shift or duplicate a page).
 *
 * This is intended for **bounded reference collections** that the codebase already reads (and caches)
 * as a whole — e.g. a workspace's action classes or contact-attribute keys. It bounds the response
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
  const nextCursor = remaining.length > options.limit ? encodeIdCursor(page[page.length - 1].id) : null;
  return { page, nextCursor };
}
