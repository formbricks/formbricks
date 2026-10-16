import "server-only";
import { z } from "zod";
import { zCreativeDisplayStatus, zCreativeType, zGetCreativesV3Query } from "@formbricks/api-v3-schemas";
import { computeFilterFingerprint } from "@/app/api/v3/lib/keyset-cursor";
import type { InvalidParam } from "@/app/api/v3/lib/response";
import { collectMultiValueQueryParam } from "@/app/api/v3/surveys/parse-v3-surveys-list-query";
import { zPostgresText } from "@/lib/utils/postgres-text";
import type { TCreativeType } from "@/modules/creatives/lib/creative";
import type { TCreativeDisplayStatus } from "@/modules/creatives/lib/display-status";
import type { TCreativeListSortBy } from "@/modules/creatives/lib/repository";

/**
 * `GET /api/v3/creatives` query parsing. A query string arrives as strings, some repeated or
 * comma-separated, which the generated typed schema can't read; this parser does that and reuses the
 * generated enums and bounds, so the accepted values still come from the contract.
 *
 * The cursor is the creatives' own keyset token: unsigned, opaque, and bound to the sort and a
 * fingerprint of the filters, so changing either mid-walk is a 400 instead of a skipped page. Its value
 * is an instant for the date sorts and the name for `name`, which the shared keyset helper (instants
 * only) can't carry.
 */

const FILTER_NAME = "filter[name][contains]";
const FILTER_TYPE = "filter[type][in]";
const FILTER_DISPLAY_STATUS = "filter[displayStatus][in]";

const SUPPORTED_PARAMS = new Set<string>(Object.keys(zGetCreativesV3Query.shape));

const generated = zGetCreativesV3Query.shape;

const ZRawQuery = z.object({
  workspaceId: generated.workspaceId,
  limit: z.preprocess((value) => (value === undefined ? undefined : Number(value)), generated.limit),
  cursor: z.string().min(1).optional(),
  [FILTER_NAME]: zPostgresText()
    .max(512)
    .optional()
    .transform((value) => value?.trim() || undefined),
  [FILTER_TYPE]: z.array(zCreativeType).optional(),
  [FILTER_DISPLAY_STATUS]: z.array(zCreativeDisplayStatus).optional(),
  surveyId: generated.surveyId,
  sortBy: generated.sortBy,
});

const CURSOR_VERSION = 1;
const MAX_CURSOR_LENGTH = 1024;

const ZCursor = z.strictObject({
  version: z.literal(CURSOR_VERSION),
  sortBy: z.enum(["updatedAt", "createdAt", "name"]),
  fp: z.string().min(1),
  value: zPostgresText().min(1).max(512),
  id: z.cuid2(),
});
type TCursor = z.infer<typeof ZCursor>;

const serializeCursor = (cursor: TCursor): string =>
  Buffer.from(
    JSON.stringify({
      version: cursor.version,
      sortBy: cursor.sortBy,
      fp: cursor.fp,
      value: cursor.value,
      id: cursor.id,
    }),
    "utf8"
  ).toString("base64url");

export class InvalidCreativeCursorError extends Error {}

const decodeCursor = (raw: string, expected: { sortBy: TCreativeListSortBy; fp: string }): TCursor => {
  if (raw.length > MAX_CURSOR_LENGTH) throw new InvalidCreativeCursorError("The cursor is invalid.");

  let cursor: TCursor;
  try {
    cursor = ZCursor.parse(JSON.parse(Buffer.from(raw, "base64url").toString("utf8")));
  } catch {
    throw new InvalidCreativeCursorError("The cursor is invalid.");
  }
  // `Buffer.from(…, "base64url")` drops characters it doesn't know, so re-encoding is what rejects a
  // token we could not have issued.
  if (serializeCursor(cursor) !== raw) throw new InvalidCreativeCursorError("The cursor is invalid.");
  if (cursor.sortBy !== expected.sortBy) {
    throw new InvalidCreativeCursorError("The cursor does not match the requested sort order.");
  }
  if (cursor.fp !== expected.fp) {
    throw new InvalidCreativeCursorError("The cursor was issued for a different filter set.");
  }
  if (cursor.sortBy !== "name" && !z.iso.datetime().safeParse(cursor.value).success) {
    throw new InvalidCreativeCursorError("The cursor is invalid.");
  }
  return cursor;
};

export type TV3CreativesListQuery = {
  workspaceId: string;
  limit: number;
  sortBy: TCreativeListSortBy;
  after: { value: string; id: string } | null;
  name?: string;
  types?: TCreativeType[];
  displayStatuses?: TCreativeDisplayStatus[];
  surveyId?: string;
  /** Mints the cursor for the page that follows `row`. */
  nextCursor: (row: { id: string; name: string; createdAt: Date; updatedAt: Date }) => string;
};

export type TV3CreativesListQueryResult =
  | { ok: true; query: TV3CreativesListQuery }
  | { ok: false; invalidParams: InvalidParam[] };

export const parseV3CreativesListQuery = (searchParams: URLSearchParams): TV3CreativesListQueryResult => {
  const unsupported = [...new Set(searchParams.keys())].filter((key) => !SUPPORTED_PARAMS.has(key));
  if (unsupported.length > 0) {
    return {
      ok: false,
      invalidParams: unsupported.map((name) => ({
        name,
        reason: `Unsupported query parameter. Use only ${[...SUPPORTED_PARAMS].join(", ")}.`,
        code: "unsupported_field",
      })),
    };
  }

  const multi = (key: string) => {
    const values = collectMultiValueQueryParam(searchParams, key);
    return values.length > 0 ? values : undefined;
  };
  const parsed = ZRawQuery.safeParse({
    workspaceId: searchParams.get("workspaceId") ?? undefined,
    limit: searchParams.get("limit") ?? undefined,
    cursor: searchParams.get("cursor")?.trim() || undefined,
    [FILTER_NAME]: searchParams.get(FILTER_NAME) ?? undefined,
    [FILTER_TYPE]: multi(FILTER_TYPE),
    [FILTER_DISPLAY_STATUS]: multi(FILTER_DISPLAY_STATUS),
    surveyId: searchParams.get("surveyId") ?? undefined,
    sortBy: searchParams.get("sortBy")?.trim() || undefined,
  });
  if (!parsed.success) {
    return {
      ok: false,
      invalidParams: parsed.error.issues.map((issue) => ({
        name: issue.path.map(String).join(".") || "query",
        reason: issue.message,
      })),
    };
  }

  const raw = parsed.data;
  const filters = {
    workspaceId: raw.workspaceId,
    name: raw[FILTER_NAME],
    types: raw[FILTER_TYPE],
    displayStatuses: raw[FILTER_DISPLAY_STATUS],
    surveyId: raw.surveyId,
  };
  const fp = computeFilterFingerprint(filters);

  let after: TV3CreativesListQuery["after"] = null;
  if (raw.cursor) {
    try {
      const cursor = decodeCursor(raw.cursor, { sortBy: raw.sortBy, fp });
      after = { value: cursor.value, id: cursor.id };
    } catch (error) {
      if (!(error instanceof InvalidCreativeCursorError)) throw error;
      return { ok: false, invalidParams: [{ name: "cursor", reason: error.message }] };
    }
  }

  const sortValue = (row: { name: string; createdAt: Date; updatedAt: Date }): string => {
    if (raw.sortBy === "name") return row.name;
    return (raw.sortBy === "createdAt" ? row.createdAt : row.updatedAt).toISOString();
  };

  return {
    ok: true,
    query: {
      ...filters,
      limit: raw.limit,
      sortBy: raw.sortBy,
      after,
      nextCursor: (row) =>
        serializeCursor({
          version: CURSOR_VERSION,
          sortBy: raw.sortBy,
          fp,
          value: sortValue(row),
          id: row.id,
        }),
    },
  };
};
