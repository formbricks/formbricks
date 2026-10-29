import "server-only";
import type { TContactAttributeKey } from "@formbricks/types/contact-attribute-key";
import { InvalidInputError } from "@formbricks/types/errors";
import { computeFilterFingerprint } from "@/app/api/v3/lib/keyset-cursor";
import { buildSortCursorPage, decodeSortCursor } from "@/app/api/v3/lib/sort-cursor";
import type { TV3ContactAttributeKeysListQuery } from "./parse-v3-contact-attribute-keys-list-query";

/**
 * Filtering, sorting and cursor paging for the contact-attribute-key list.
 *
 * In memory, like the original endpoint (`paginateByIdCursor`): attribute keys are a bounded reference
 * collection the codebase already reads whole through the request-deduped `getContactAttributeKeys`.
 * The cursor is the sort-bound kind from `sort-cursor.ts` — it carries the last row's sort value as
 * well as its id, so a page stays correct when that row is deleted or renamed between requests.
 */

export const CONTACT_ATTRIBUTE_KEYS_CURSOR_KIND = "contact-attribute-keys";

type TSortSpec = { value: (key: TContactAttributeKey) => string; direction: 1 | -1 };

/**
 * `name` sorts by what the Attributes table displays (`name ?? key`), case-folded. Timestamps sort by
 * their ISO string, which orders exactly like the instant. Ties always break on `id` in the same
 * direction, so the order is total.
 */
const SORTS: Record<TV3ContactAttributeKeysListQuery["sortBy"], TSortSpec> = {
  id: { value: (key) => key.id, direction: 1 },
  name: { value: (key) => (key.name ?? key.key).toLowerCase(), direction: 1 },
  createdAt: { value: (key) => key.createdAt.toISOString(), direction: 1 },
  "-createdAt": { value: (key) => key.createdAt.toISOString(), direction: -1 },
  updatedAt: { value: (key) => key.updatedAt.toISOString(), direction: 1 },
  "-updatedAt": { value: (key) => key.updatedAt.toISOString(), direction: -1 },
};

/** Code-unit comparison: locale-independent, so every replica orders (and pages) identically. */
const byCodeUnit = (a: string, b: string): number => {
  if (a < b) return -1;
  return a > b ? 1 : 0;
};

const comparePositions = (
  a: { value: string; id: string },
  b: { value: string; id: string },
  direction: 1 | -1
): number => (byCodeUnit(a.value, b.value) || byCodeUnit(a.id, b.id)) * direction;

export const matchesContactAttributeKeyFilters = (
  key: TContactAttributeKey,
  query: Pick<TV3ContactAttributeKeysListQuery, "search" | "dataTypeIn" | "typeIn">
): boolean => {
  if (query.dataTypeIn && !query.dataTypeIn.includes(key.dataType)) return false;
  if (query.typeIn && !query.typeIn.includes(key.type)) return false;
  if (query.search) {
    const needle = query.search.toLowerCase();
    const haystacks = [key.key, key.name, key.description];
    if (!haystacks.some((value) => value?.toLowerCase().includes(needle))) return false;
  }
  return true;
};

export const computeContactAttributeKeysFingerprint = (
  workspaceId: string,
  query: Pick<TV3ContactAttributeKeysListQuery, "search" | "dataTypeIn" | "typeIn">
): string =>
  computeFilterFingerprint({
    workspaceId,
    search: query.search,
    dataTypeIn: query.dataTypeIn,
    typeIn: query.typeIn,
  });

/**
 * The original endpoint's cursor was the bare base64url id of the last row. It is still honoured for
 * the default (`id`) order with no filters, so a client paging across the deploy keeps its place.
 */
const decodeLegacyIdCursor = (raw: string): { value: string; id: string } | null => {
  const decoded = Buffer.from(raw, "base64url").toString("utf8");
  const isCanonical = decoded.length > 0 && Buffer.from(decoded, "utf8").toString("base64url") === raw;
  return isCanonical && /^[a-z0-9]+$/.test(decoded) ? { value: decoded, id: decoded } : null;
};

const decodeCursor = (
  raw: string,
  sortBy: TV3ContactAttributeKeysListQuery["sortBy"],
  fp: string
): { value: string | null; id: string } => {
  try {
    return decodeSortCursor(raw, { kind: CONTACT_ATTRIBUTE_KEYS_CURSOR_KIND, sortBy, fp });
  } catch (error) {
    const legacy = sortBy === "id" ? decodeLegacyIdCursor(raw) : null;
    if (legacy) return legacy;
    throw error instanceof InvalidInputError ? error : new InvalidInputError("The cursor is invalid.");
  }
};

/**
 * Filter, sort and page. Throws `InvalidInputError` for a cursor that is malformed or was issued for a
 * different sort or filter set; the operation maps it to a 400 naming `cursor`.
 */
export function listContactAttributeKeysPage(
  keys: readonly TContactAttributeKey[],
  workspaceId: string,
  query: TV3ContactAttributeKeysListQuery
): { page: TContactAttributeKey[]; nextCursor: string | null; totalCount: number } {
  const sort = SORTS[query.sortBy];
  const fp = computeContactAttributeKeysFingerprint(workspaceId, query);
  const position = (key: TContactAttributeKey) => ({ value: sort.value(key), id: key.id });

  const matching = keys
    .filter((key) => matchesContactAttributeKeyFilters(key, query))
    .sort((a, b) => comparePositions(position(a), position(b), sort.direction));

  let remaining = matching;
  if (query.cursor) {
    const decoded = decodeCursor(query.cursor, query.sortBy, fp);
    // A name too long to carry in the token is re-read from the key it names.
    const anchor = decoded.value === null ? keys.find((key) => key.id === decoded.id) : undefined;
    if (decoded.value === null && !anchor) throw new InvalidInputError("The cursor is invalid.");
    const cursor = anchor ? position(anchor) : { value: decoded.value as string, id: decoded.id };
    remaining = matching.filter((key) => comparePositions(position(key), cursor, sort.direction) > 0);
  }

  const { page, nextCursor } = buildSortCursorPage({
    rows: remaining.slice(0, query.limit + 1),
    limit: query.limit,
    kind: CONTACT_ATTRIBUTE_KEYS_CURSOR_KIND,
    sortBy: query.sortBy,
    fp,
    sortValue: sort.value,
  });

  return { page, nextCursor, totalCount: matching.length };
}
