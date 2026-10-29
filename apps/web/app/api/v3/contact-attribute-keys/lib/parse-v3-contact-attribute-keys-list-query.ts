import { z } from "zod";
import { ZContactAttributeDataType, ZContactAttributeKeyType } from "@formbricks/types/contact-attribute-key";
import { V3_LIST_DEFAULT_LIMIT, V3_LIST_MAX_LIMIT } from "@/app/api/v3/lib/cursor-pagination";
import { zPostgresText } from "@/lib/utils/postgres-text";

/**
 * Query parsing for `GET /api/v3/contact-attribute-keys`.
 *
 * Every addition is optional and the defaults reproduce the original endpoint exactly — `id` order,
 * no `totalCount`, the original id cursor — so an existing caller sees no change beyond the additive
 * `createdAt`/`updatedAt`/`isUnique` fields and a `meta.totalCount` of `null`.
 */

const FILTER_DATA_TYPE_IN = "filter[dataType][in]" as const;
const FILTER_TYPE_IN = "filter[type][in]" as const;

const SUPPORTED_QUERY_PARAMS = [
  "workspaceId",
  "limit",
  "cursor",
  "includeTotalCount",
  "search",
  "sortBy",
  FILTER_DATA_TYPE_IN,
  FILTER_TYPE_IN,
] as const;
const SUPPORTED_QUERY_PARAM_SET = new Set<string>(SUPPORTED_QUERY_PARAMS);
const MULTI_VALUE_PARAMS = new Set<string>([FILTER_DATA_TYPE_IN, FILTER_TYPE_IN]);

export const V3_CONTACT_ATTRIBUTE_KEY_SORTS = [
  "createdAt",
  "-createdAt",
  "name",
  "updatedAt",
  "-updatedAt",
] as const;
export type TV3ContactAttributeKeySort = (typeof V3_CONTACT_ATTRIBUTE_KEY_SORTS)[number];

/** The pre-existing order (`id` ascending), used when `sortBy` is absent. Never accepted as input. */
export const V3_CONTACT_ATTRIBUTE_KEY_DEFAULT_SORT = "id" as const;

export type TV3InvalidParam = { name: string; reason: string };

export type TV3ContactAttributeKeysListQuery = {
  workspaceId: string;
  limit: number;
  cursor?: string;
  includeTotalCount: boolean;
  search?: string;
  sortBy: TV3ContactAttributeKeySort | typeof V3_CONTACT_ATTRIBUTE_KEY_DEFAULT_SORT;
  dataTypeIn?: z.infer<typeof ZContactAttributeDataType>[];
  typeIn?: z.infer<typeof ZContactAttributeKeyType>[];
};

const ZQuery = z.object({
  workspaceId: z.cuid2(),
  limit: z.coerce.number().int().min(1).max(V3_LIST_MAX_LIMIT).default(V3_LIST_DEFAULT_LIMIT),
  cursor: z.string().min(1).optional(),
  // Off by default here (unlike surveys/contacts) so the original response is unchanged.
  includeTotalCount: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .default(false),
  search: zPostgresText()
    .max(512)
    .optional()
    .transform((value) => (value === undefined || value.trim() === "" ? undefined : value.trim())),
  sortBy: z.enum(V3_CONTACT_ATTRIBUTE_KEY_SORTS).optional(),
  [FILTER_DATA_TYPE_IN]: z.array(ZContactAttributeDataType).min(1).optional(),
  [FILTER_TYPE_IN]: z.array(ZContactAttributeKeyType).min(1).optional(),
});

const collectMultiValue = (searchParams: URLSearchParams, key: string): string[] | undefined => {
  const values = new Set<string>();
  for (const raw of searchParams.getAll(key)) {
    for (const part of raw.split(",")) {
      const trimmed = part.trim();
      if (trimmed) values.add(trimmed);
    }
  }
  return values.size > 0 ? [...values] : undefined;
};

export function parseV3ContactAttributeKeysListQuery(
  searchParams: URLSearchParams
): ({ ok: true } & TV3ContactAttributeKeysListQuery) | { ok: false; invalid_params: TV3InvalidParam[] } {
  const keys = [...new Set(searchParams.keys())];
  const unsupported = keys.filter((key) => !SUPPORTED_QUERY_PARAM_SET.has(key));
  if (unsupported.length > 0) {
    return {
      ok: false,
      invalid_params: unsupported.map((name) => ({
        name,
        reason: `Unsupported query parameter. Use only ${SUPPORTED_QUERY_PARAMS.join(", ")}.`,
      })),
    };
  }

  const repeated = keys.filter((key) => !MULTI_VALUE_PARAMS.has(key) && searchParams.getAll(key).length > 1);
  if (repeated.length > 0) {
    return {
      ok: false,
      invalid_params: repeated.map((name) => ({ name, reason: "Must be sent at most once." })),
    };
  }

  const parsed = ZQuery.safeParse({
    workspaceId: searchParams.get("workspaceId") ?? undefined,
    limit: searchParams.get("limit") ?? undefined,
    cursor: searchParams.get("cursor")?.trim() || undefined,
    includeTotalCount: searchParams.get("includeTotalCount")?.trim() || undefined,
    search: searchParams.get("search") ?? undefined,
    sortBy: searchParams.get("sortBy")?.trim() || undefined,
    [FILTER_DATA_TYPE_IN]: collectMultiValue(searchParams, FILTER_DATA_TYPE_IN),
    [FILTER_TYPE_IN]: collectMultiValue(searchParams, FILTER_TYPE_IN),
  });

  if (!parsed.success) {
    return {
      ok: false,
      invalid_params: parsed.error.issues.map((issue) => ({
        name: issue.path.join(".") || "query",
        reason: issue.message,
      })),
    };
  }

  const q = parsed.data;
  return {
    ok: true,
    workspaceId: q.workspaceId,
    limit: q.limit,
    cursor: q.cursor,
    includeTotalCount: q.includeTotalCount,
    search: q.search,
    sortBy: q.sortBy ?? V3_CONTACT_ATTRIBUTE_KEY_DEFAULT_SORT,
    dataTypeIn: q[FILTER_DATA_TYPE_IN],
    typeIn: q[FILTER_TYPE_IN],
  };
}
