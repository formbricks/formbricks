import "server-only";
import { createHash } from "node:crypto";
import { z } from "zod";
import { Prisma } from "@formbricks/database/prisma";
import { InvalidInputError } from "@formbricks/types/errors";

/**
 * Keyset (seek) pagination for the v3 collection endpoints that page over a database table.
 *
 * Not the same thing as `cursor-pagination.ts`, and not a replacement for it: that one slices an
 * already-fetched array for bounded reference collections, and its own comment excludes the large
 * tables. This one produces the SQL a large table needs.
 *
 * ## Why the predicate is raw SQL
 *
 * The page condition has to be a **row-constructor comparison** — `(sort_col, id) < ($1, $2)` — because
 * that is the only form PostgreSQL puts inside the Index Cond. Two alternatives were measured on a
 * 300k-row Response-shaped table with 50-row tie groups, paging a scoped list for 20 rows:
 *
 * | index                        | predicate        | rows discarded | buffers |
 * | ---------------------------- | ---------------- | -------------- | ------- |
 * | `(surveyId, created_at)`     | `OR` expansion   | 4000           | 1832    |
 * | `(surveyId, created_at)`     | row-constructor  | 2              | 23      |
 * | `(surveyId, created_at, id)` | row-constructor  | 0              | 4       |
 *
 * The `OR` expansion — `sort < $1 OR (sort = $1 AND id < $2)` — plans as a plain Filter and rescans the
 * range from the top on every page. Prisma's own `cursor` + `skip: 1` is no better; it emits three
 * correlated subqueries. Neither can express a row constructor, hence `Prisma.sql`.
 *
 * The existing implementations in `modules/survey/list/lib/survey-page.ts` and
 * `packages/workflows/src/handlers/cursor.ts` both use the `OR` form and carry that cost.
 *
 * ## Why the token is not signed
 *
 * It carries no authority. The scope and the allow-listed filters are re-derived from the request and
 * authorized *before* the cursor is decoded, and the `id` inside it is only ever a comparison operand —
 * never dereferenced, so it cannot be an existence oracle. An HMAC over a payload that grants nothing
 * would only make a *consistency* check unforgeable, at the cost of a secret every self-hoster holds and
 * a dual-key window on rotation. None of Stripe, GitHub, Slack, Linear, Shopify, Twilio, Atlassian,
 * Notion, Intercom or the Relay spec signs its cursor, and no normative source requires it — AIP-158
 * does not mention signing at all and mandates re-authorization per request instead. See RFC §2c.
 *
 * What the token *is* bound to is the sort order and a fingerprint of the filter set, so that changing
 * either mid-walk is a 400 rather than a silently truncated page. That binding is the part both existing
 * implementations are missing.
 */

const CURSOR_VERSION = 1 as const;

/** Bounds the token before it reaches `JSON.parse`. A real cursor is ~150 bytes. */
const MAX_CURSOR_LENGTH = 512;

/** Enough to make a collision between two filter sets a non-event; this is a mismatch check, not a MAC. */
const FINGERPRINT_LENGTH = 16;

export type TKeysetDirection = "asc" | "desc";

/**
 * The decoded position. `value` is the sort column's value at the last row of the previous page and
 * `id` is its primary key — together they are a total order, so no row is skipped or repeated.
 */
export type TKeysetCursor = {
  version: typeof CURSOR_VERSION;
  kind: string;
  sortBy: string;
  fp: string;
  value: string;
  id: string;
};

const ZKeysetCursor = z
  .strictObject({
    version: z.literal(CURSOR_VERSION),
    kind: z.string().min(1),
    sortBy: z.string().min(1),
    fp: z.string().length(FINGERPRINT_LENGTH),
    // `Z` form only, deliberately — see `decodeKeysetCursor`.
    value: z.iso.datetime(),
    id: z.cuid2(),
  })
  .readonly();

/**
 * Field order is fixed and load-bearing: `decodeKeysetCursor` re-encodes the parsed object and compares
 * it to the token it was given, so a reordered or re-spaced token is rejected rather than silently
 * accepted as a second spelling of the same position.
 */
const serialize = (cursor: TKeysetCursor): string =>
  JSON.stringify({
    version: cursor.version,
    kind: cursor.kind,
    sortBy: cursor.sortBy,
    fp: cursor.fp,
    value: cursor.value,
    id: cursor.id,
  });

export const encodeKeysetCursor = (cursor: TKeysetCursor): string =>
  Buffer.from(serialize(cursor), "utf8").toString("base64url");

/**
 * A stable fingerprint of everything the page is scoped and filtered by.
 *
 * Computed from the **parsed and normalized** filter object rather than the raw query string, so that a
 * caller reordering or re-spelling parameters does not invalidate a cursor, and so that a filter added
 * later cannot fall out of the binding by being missed off a hardcoded list.
 *
 * What belongs in it: the authorized scope and every allow-listed filter. What does **not**: `limit`,
 * `includeTotalCount`, `precision` or any api-version. AIP-158 requires that a changed page size be
 * honoured mid-pagination, so binding those would turn a legal request into a 400.
 *
 * **Testing note.** `apps/web/vitestSetup.ts` mocks `createHash` globally to return the literal
 * `"fake-hash"`. Under that mock every fingerprint is identical, so the binding silently becomes a
 * no-op and a test asserting it would pass whatever this did. Restore the real implementation in any
 * suite that exercises the binding — see `keyset-cursor.test.ts`.
 *
 * Including a hash of the workspace id is not "tenancy in the cursor" — the distinction matters. This is
 * a *rejection* input, never a lookup input: the scope is still derived from the request and authorized
 * before this is even computed. It catches a client that changes workspace mid-walk; it can never grant
 * access to one.
 */
/**
 * One filter value, rendered so that two different values can never render alike.
 *
 * `String()` is not good enough and the failure is silent: `String(new Date())` is second-precision
 * and carries the local zone name, so two instants in the same second fingerprint identically and the
 * same instant fingerprints differently on a replica in another timezone; and every object becomes
 * `"[object Object]"`, so a range filter would contribute nothing but its key. Both turn the binding
 * into a no-op for exactly the filters `Response` is most likely to grow — a `createdAt` range.
 *
 * Non-scalars throw rather than degrade. A helper whose whole value is that a filter cannot fall out
 * of the binding should fail at the callsite, not quietly stop binding.
 */
const renderFilterValue = (value: unknown): string => {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === "object") {
    throw new TypeError("computeFilterFingerprint: filter values must be scalars, Dates, or arrays of those");
  }

  return String(value);
};

export const computeFilterFingerprint = (filters: Record<string, unknown>): string => {
  const canonical = Object.keys(filters)
    .filter((key) => filters[key] !== undefined && filters[key] !== null)
    .sort()
    .map((key) => {
      const value = filters[key];
      // Sorted, so `[in]` members supplied in a different order are the same filter.
      const rendered = Array.isArray(value)
        ? [...value].map(renderFilterValue).sort().join(",")
        : renderFilterValue(value);
      // Written as escapes, not literal bytes: a raw NUL in the source makes git treat the whole
      // file as binary, so the module disappears from every diff. NUL and SOH are the separators
      // because neither can occur in a key or in any value we fingerprint, which is what stops
      // `{a: "b", c: ""}` and `{a: "bc"}` hashing alike.
      return `${key}\u0000${rendered}`;
    })
    .join("\u0001");

  return createHash("sha256").update(canonical, "utf8").digest("base64url").slice(0, FINGERPRINT_LENGTH);
};

/**
 * Decode and fully validate a caller-supplied cursor.
 *
 * Every failure throws `InvalidInputError`, which the **query-parse layer** turns into a 400 with
 * `invalid_params[].name = "cursor"`. Call this there, never inside a service: `mapV3ThrownError`
 * deliberately does not map `InvalidInputError`, so the same guard firing deeper down answers 500.
 */
export const decodeKeysetCursor = (
  raw: string,
  expected: { kind: string; sortBy: string; fp: string }
): TKeysetCursor => {
  // Before `Buffer.from`, so an oversized token never reaches the JSON parser.
  if (raw.length > MAX_CURSOR_LENGTH) {
    throw new InvalidInputError("The cursor is invalid.");
  }

  let parsed: TKeysetCursor;
  try {
    parsed = ZKeysetCursor.parse(JSON.parse(Buffer.from(raw, "base64url").toString("utf8")));
  } catch {
    throw new InvalidInputError("The cursor is invalid.");
  }

  // `Buffer.from(…, "base64url")` is lenient — it drops characters it does not recognise rather than
  // throwing — so without this, `"!!" + cursor`, `cursor + "="` and `cursor + "\n"` are all accepted as
  // the same position. Re-encoding the *parsed object* (not the decoded string) also catches key
  // reordering and whitespace, which is what makes the token a stable identity.
  if (encodeKeysetCursor(parsed) !== raw) {
    throw new InvalidInputError("The cursor is invalid.");
  }

  // No `Number.isFinite(new Date(value))` guard: `z.iso.datetime()` already rejects every impossible
  // date, including 2026-02-30 and 2027-02-29, so such a check can never fire. Dead code shaped like a
  // safety check implies a hazard that is not there.

  // A cursor minted for another collection must not validate here, even if its fields happen to fit.
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
 * The page predicate, as a composable fragment.
 *
 * Returned rather than executed because the caller has to complete it — the scope join and the
 * allow-listed filters are its business, not this module's. Compose with `Prisma.join([...], " AND ")`
 * so the scope can never be shadowed by the page condition.
 *
 * `sortColumn` and `idColumn` are `Prisma.Sql` (build them with `Prisma.raw` from a literal, never from
 * caller input) because identifiers cannot be parameterized; `value` and `id` are bound parameters.
 */
export const keysetPagePredicate = ({
  sortColumn,
  idColumn,
  direction,
  cursor,
}: {
  sortColumn: Prisma.Sql;
  idColumn: Prisma.Sql;
  direction: TKeysetDirection;
  cursor: Pick<TKeysetCursor, "value" | "id">;
}): Prisma.Sql => {
  const comparison = direction === "desc" ? Prisma.raw("<") : Prisma.raw(">");

  return Prisma.sql`(${sortColumn}, ${idColumn}) ${comparison} (${new Date(cursor.value)}, ${cursor.id})`;
};

/** `ORDER BY` matching the predicate. The two must agree or the keyset walks the wrong way. */
export const keysetOrderBy = ({
  sortColumn,
  idColumn,
  direction,
}: {
  sortColumn: Prisma.Sql;
  idColumn: Prisma.Sql;
  direction: TKeysetDirection;
}): Prisma.Sql => {
  const order = direction === "desc" ? Prisma.raw("DESC") : Prisma.raw("ASC");

  return Prisma.sql`ORDER BY ${sortColumn} ${order}, ${idColumn} ${order}`;
};

/**
 * Turn a page of rows into the next cursor.
 *
 * Takes `limit + 1` rows and returns the page plus the token, so end-of-collection is decided by whether
 * an extra row existed rather than by comparing the page length to `limit` — a page can legitimately be
 * short. `nextCursor` is `null` at the end, which the contract makes the only end signal.
 */
export const buildKeysetPage = <T extends { id: string }>({
  rows,
  limit,
  kind,
  sortBy,
  fp,
  sortValue,
}: {
  rows: T[];
  limit: number;
  kind: string;
  sortBy: string;
  fp: string;
  sortValue: (row: T) => Date;
}): { page: T[]; nextCursor: string | null } => {
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const last = page.at(-1);

  if (!hasMore || !last) {
    return { page, nextCursor: null };
  }

  return {
    page,
    nextCursor: encodeKeysetCursor({
      version: CURSOR_VERSION,
      kind,
      sortBy,
      fp,
      value: sortValue(last).toISOString(),
      id: last.id,
    }),
  };
};
