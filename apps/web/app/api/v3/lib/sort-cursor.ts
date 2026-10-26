import "server-only";
import { z } from "zod";
import { InvalidInputError } from "@formbricks/types/errors";

/**
 * Opaque, sort-bound cursor for v3 lists whose sort column is not (only) a timestamp.
 *
 * `keyset-cursor.ts` is the right tool for a `(timestamp, id)` walk, but its token only carries an ISO
 * datetime, so a list sorted by a text column (a segment title, an attribute-key name) cannot use it.
 * This one carries the sort value as a plain string and keeps the same guarantees: it is bound to the
 * collection (`kind`), the sort order and a fingerprint of the filter set (`computeFilterFingerprint`),
 * and every mismatch or malformed token throws `InvalidInputError` so the parse layer answers 400
 * naming `cursor`.
 *
 * The token is not signed for the reason `keyset-cursor.ts` gives: it grants nothing. Scope and filters
 * are re-derived from the request and authorized before the cursor is read.
 */

const SORT_CURSOR_VERSION = 1 as const;

/** Bounds the token before it reaches `JSON.parse`. */
const MAX_SORT_CURSOR_LENGTH = 2048;

export type TSortCursor = {
  version: typeof SORT_CURSOR_VERSION;
  kind: string;
  sortBy: string;
  fp: string;
  /** The sort column's value at the last row of the previous page, rendered as a string. */
  value: string;
  id: string;
};

const ZSortCursor = z.strictObject({
  version: z.literal(SORT_CURSOR_VERSION),
  kind: z.string().min(1).max(64),
  sortBy: z.string().min(1).max(64),
  fp: z.string().min(1).max(64),
  value: z.string().max(1024),
  id: z.string().min(1).max(64),
});

/** Fixed field order: decode re-encodes the parsed object and compares, so a re-spelled token is rejected. */
const serialize = (cursor: TSortCursor): string =>
  JSON.stringify({
    version: cursor.version,
    kind: cursor.kind,
    sortBy: cursor.sortBy,
    fp: cursor.fp,
    value: cursor.value,
    id: cursor.id,
  });

export const encodeSortCursor = (cursor: Omit<TSortCursor, "version">): string =>
  Buffer.from(serialize({ ...cursor, version: SORT_CURSOR_VERSION }), "utf8").toString("base64url");

export const decodeSortCursor = (
  raw: string,
  expected: { kind: string; sortBy: string; fp: string }
): TSortCursor => {
  if (raw.length > MAX_SORT_CURSOR_LENGTH) {
    throw new InvalidInputError("The cursor is invalid.");
  }

  let parsed: TSortCursor;
  try {
    parsed = ZSortCursor.parse(JSON.parse(Buffer.from(raw, "base64url").toString("utf8")));
  } catch {
    throw new InvalidInputError("The cursor is invalid.");
  }

  // `Buffer.from(…, "base64url")` silently drops characters it does not recognise; the round trip is
  // what makes the token a single, stable spelling.
  if (encodeSortCursor(parsed) !== raw) {
    throw new InvalidInputError("The cursor is invalid.");
  }

  if (parsed.kind !== expected.kind) {
    throw new InvalidInputError("The cursor is invalid.");
  }

  if (parsed.sortBy !== expected.sortBy) {
    throw new InvalidInputError("The cursor does not match the requested sort order.");
  }

  if (parsed.fp !== expected.fp) {
    throw new InvalidInputError("The cursor was issued for a different filter set.");
  }

  return parsed;
};

/**
 * Turn `limit + 1` fetched rows into a page and the next cursor. End of collection is decided by
 * whether the extra row existed, never by comparing the page length to `limit`.
 */
export const buildSortCursorPage = <T extends { id: string }>({
  rows,
  limit,
  kind,
  sortBy,
  fp,
  sortValue,
}: {
  rows: readonly T[];
  limit: number;
  kind: string;
  sortBy: string;
  fp: string;
  sortValue: (row: T) => string;
}): { page: T[]; nextCursor: string | null } => {
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : [...rows];
  const last = page.at(-1);

  if (!hasMore || !last) {
    return { page, nextCursor: null };
  }

  return {
    page,
    nextCursor: encodeSortCursor({ kind, sortBy, fp, value: sortValue(last), id: last.id }),
  };
};
