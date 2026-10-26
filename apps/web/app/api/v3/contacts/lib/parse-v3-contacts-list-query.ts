import { z } from "zod";
import type { TContactAttributeDataType } from "@formbricks/types/contact-attribute-key";
import {
  type TKeysetCursor,
  computeFilterFingerprint,
  decodeKeysetCursor,
} from "@/app/api/v3/lib/keyset-cursor";
import { zPostgresText } from "@/lib/utils/postgres-text";

/**
 * Query parsing for `GET /api/v3/contacts`, in two steps because attribute filters can only be typed
 * once the workspace's attribute keys are known:
 *
 * 1. {@link parseV3ContactsListQuery} — pure syntax: unknown parameters, the fixed parameters, the shape
 *    of every `filter[attribute.<key>][<op>]` and the caps. Runs before authorization.
 * 2. {@link resolveV3ContactAttributeFilters} — after the keys are loaded (scoped to the authorized
 *    workspace): unknown key → 400, operator not allowed for the key's `dataType` → 400, value not
 *    parseable for the `dataType` → 400. Then the cursor is decoded against the fingerprint of the
 *    *resolved* filter set, so a cursor can never outlive a change of filters.
 */

export const V3_CONTACTS_DEFAULT_LIMIT = 50;
export const V3_CONTACTS_MAX_LIMIT = 250;
/**
 * The most distinct `filter[...]` parameters one request may carry. Repeated keys of one `in` filter
 * count once here — they are bounded by {@link V3_CONTACTS_MAX_IN_VALUES} instead.
 */
export const V3_CONTACTS_MAX_FILTER_PARAMS = 50;
/** The most values one `in` filter may carry. */
export const V3_CONTACTS_MAX_IN_VALUES = 100;
const MAX_FILTER_VALUE_LENGTH = 512;

export const CONTACTS_CURSOR_KIND = "contacts";

const CREATED_AT_GTE = "filter[createdAt][gte]" as const;
const CREATED_AT_LTE = "filter[createdAt][lte]" as const;

const FIXED_QUERY_PARAMS = [
  "workspaceId",
  "limit",
  "cursor",
  "includeTotalCount",
  "search",
  "sortBy",
  CREATED_AT_GTE,
  CREATED_AT_LTE,
] as const;
const FIXED_QUERY_PARAM_SET = new Set<string>(FIXED_QUERY_PARAMS);

/** `filter[attribute.<key>][<op>]`. Attribute keys are safe identifiers, so they never contain `]`. */
const ATTRIBUTE_FILTER_PATTERN = /^filter\[attribute\.([^\]]+)\]\[([A-Za-z]+)\]$/;

export const STRING_OPERATORS = [
  "in",
  "equals",
  "notEquals",
  "contains",
  "doesNotContain",
  "startsWith",
  "endsWith",
  "isSet",
  "isNotSet",
] as const;
export const NUMBER_OPERATORS = [
  "in",
  "equals",
  "notEquals",
  "greaterThan",
  "greaterEqual",
  "lessThan",
  "lessEqual",
  "isSet",
  "isNotSet",
] as const;
export const DATE_OPERATORS = ["gte", "lte", "isSet", "isNotSet"] as const;

const OPERATORS_BY_DATA_TYPE: Record<TContactAttributeDataType, readonly string[]> = {
  string: STRING_OPERATORS,
  number: NUMBER_OPERATORS,
  date: DATE_OPERATORS,
};

const ALL_OPERATORS = new Set<string>([...STRING_OPERATORS, ...NUMBER_OPERATORS, ...DATE_OPERATORS]);

export type TV3StringOperator = (typeof STRING_OPERATORS)[number];
export type TV3NumberOperator = (typeof NUMBER_OPERATORS)[number];
export type TV3DateOperator = (typeof DATE_OPERATORS)[number];

export type TV3InvalidParam = { name: string; reason: string };

export type TV3ContactsSort = "-createdAt" | "createdAt";

/** A syntactically valid attribute filter, not yet typed against its key. */
export type TV3RawAttributeFilter = {
  param: string;
  key: string;
  operator: string;
  values: string[];
};

/** An attribute filter typed against its key's `dataType`, carrying the key's id for the query. */
export type TV3ContactAttributeFilter =
  | { key: string; attributeKeyId: string; dataType: "string"; operator: TV3StringOperator; values: string[] }
  | { key: string; attributeKeyId: string; dataType: "number"; operator: TV3NumberOperator; values: number[] }
  | { key: string; attributeKeyId: string; dataType: "date"; operator: TV3DateOperator; values: Date[] };

export type TV3ContactsListQuery = {
  workspaceId: string;
  limit: number;
  cursor?: string;
  includeTotalCount: boolean;
  search?: string;
  sortBy: TV3ContactsSort;
  createdAtGte?: Date;
  createdAtLte?: Date;
  attributeFilters: TV3RawAttributeFilter[];
};

export type TV3ContactsListQueryParseResult =
  | ({ ok: true } & TV3ContactsListQuery)
  | { ok: false; invalid_params: TV3InvalidParam[] };

const ZDateBound = z.iso.datetime({ offset: true }).transform((value) => new Date(value));

const ZFixedQuery = z.object({
  workspaceId: z.cuid2(),
  limit: z.coerce.number().int().min(1).max(V3_CONTACTS_MAX_LIMIT).default(V3_CONTACTS_DEFAULT_LIMIT),
  cursor: z.string().min(1).optional(),
  includeTotalCount: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .default(true),
  search: zPostgresText()
    .max(512)
    .optional()
    .transform((value) => (value === undefined || value.trim() === "" ? undefined : value.trim())),
  sortBy: z.enum(["-createdAt", "createdAt"]).default("-createdAt"),
  [CREATED_AT_GTE]: ZDateBound.optional(),
  [CREATED_AT_LTE]: ZDateBound.optional(),
});

const issuesToInvalidParams = (error: z.ZodError): TV3InvalidParam[] =>
  error.issues.map((issue) => ({ name: issue.path.join(".") || "query", reason: issue.message }));

const singleOrUndefined = (searchParams: URLSearchParams, key: string): string | undefined =>
  searchParams.get(key)?.trim() || undefined;

/** Collects the attribute filters, or reports why a `filter[...]` key is not one. */
const collectAttributeFilters = (
  searchParams: URLSearchParams
): { filters: TV3RawAttributeFilter[]; invalid: TV3InvalidParam[] } => {
  const filters: TV3RawAttributeFilter[] = [];
  const invalid: TV3InvalidParam[] = [];

  for (const param of new Set(searchParams.keys())) {
    if (FIXED_QUERY_PARAM_SET.has(param)) continue;

    const match = ATTRIBUTE_FILTER_PATTERN.exec(param);
    if (!match) {
      invalid.push({
        name: param,
        reason: `Unsupported query parameter. Use only ${FIXED_QUERY_PARAMS.join(", ")} or filter[attribute.<key>][<operator>].`,
      });
      continue;
    }

    const [, key, operator] = match;
    if (!ALL_OPERATORS.has(operator)) {
      invalid.push({ name: param, reason: `Unknown operator "${operator}".` });
      continue;
    }

    const rawValues = searchParams.getAll(param);
    // `in` is the only multi-value operator. Values are taken verbatim per repeated key — never split
    // on commas, because a string attribute value can legitimately contain one.
    if (operator !== "in" && rawValues.length > 1) {
      invalid.push({ name: param, reason: `Operator "${operator}" accepts a single value.` });
      continue;
    }

    const values = operator === "in" ? [...new Set(rawValues)] : rawValues;
    if (values.length > V3_CONTACTS_MAX_IN_VALUES) {
      invalid.push({
        name: param,
        reason: `At most ${String(V3_CONTACTS_MAX_IN_VALUES)} values are allowed per filter.`,
      });
      continue;
    }

    filters.push({ param, key, operator, values });
  }

  return { filters, invalid };
};

export function parseV3ContactsListQuery(searchParams: URLSearchParams): TV3ContactsListQueryParseResult {
  const filterParamCount = new Set([...searchParams.keys()].filter((key) => key.startsWith("filter["))).size;
  if (filterParamCount > V3_CONTACTS_MAX_FILTER_PARAMS) {
    return {
      ok: false,
      invalid_params: [
        {
          name: "filter",
          reason: `At most ${String(V3_CONTACTS_MAX_FILTER_PARAMS)} filter parameters are allowed.`,
        },
      ],
    };
  }

  const { filters, invalid } = collectAttributeFilters(searchParams);
  if (invalid.length > 0) {
    return { ok: false, invalid_params: invalid };
  }

  const repeatedFixed = FIXED_QUERY_PARAMS.filter((key) => searchParams.getAll(key).length > 1);
  if (repeatedFixed.length > 0) {
    return {
      ok: false,
      invalid_params: repeatedFixed.map((name) => ({ name, reason: "Must be sent at most once." })),
    };
  }

  const parsed = ZFixedQuery.safeParse({
    workspaceId: searchParams.get("workspaceId") ?? undefined,
    limit: searchParams.get("limit") ?? undefined,
    cursor: singleOrUndefined(searchParams, "cursor"),
    includeTotalCount: singleOrUndefined(searchParams, "includeTotalCount"),
    search: searchParams.get("search") ?? undefined,
    sortBy: singleOrUndefined(searchParams, "sortBy"),
    [CREATED_AT_GTE]: singleOrUndefined(searchParams, CREATED_AT_GTE),
    [CREATED_AT_LTE]: singleOrUndefined(searchParams, CREATED_AT_LTE),
  });

  if (!parsed.success) {
    return { ok: false, invalid_params: issuesToInvalidParams(parsed.error) };
  }

  const q = parsed.data;
  const createdAtGte = q[CREATED_AT_GTE];
  const createdAtLte = q[CREATED_AT_LTE];
  if (createdAtGte && createdAtLte && createdAtGte > createdAtLte) {
    return {
      ok: false,
      invalid_params: [
        { name: CREATED_AT_GTE, reason: "The lower bound must not be later than the upper bound." },
      ],
    };
  }

  return {
    ok: true,
    workspaceId: q.workspaceId,
    limit: q.limit,
    cursor: q.cursor,
    includeTotalCount: q.includeTotalCount,
    search: q.search,
    sortBy: q.sortBy,
    createdAtGte,
    createdAtLte,
    attributeFilters: filters,
  };
}

type TAttributeKeyRef = { id: string; key: string; dataType: TContactAttributeDataType };

const ZFilterText = zPostgresText().min(1).max(MAX_FILTER_VALUE_LENGTH);
const ZFilterDate = z.iso.datetime({ offset: true });

const isValueless = (operator: string): boolean => operator === "isSet" || operator === "isNotSet";

const parseNumber = (raw: string): number | null => {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : null;
};

/** Types one filter's values, or returns the reason they do not fit the key's `dataType`. */
const typeFilterValues = (
  filter: TV3RawAttributeFilter,
  dataType: TContactAttributeDataType
): { ok: true; values: string[] | number[] | Date[] } | { ok: false; reason: string } => {
  // isSet / isNotSet ignore their value (the frontend sends `true`), so nothing is validated.
  if (isValueless(filter.operator)) return { ok: true, values: [] };

  if (dataType === "string") {
    for (const value of filter.values) {
      const result = ZFilterText.safeParse(value);
      if (!result.success) {
        return {
          ok: false,
          reason: `Values must be 1–${String(MAX_FILTER_VALUE_LENGTH)} characters: ${result.error.issues[0]?.message ?? "invalid"}.`,
        };
      }
    }
    return { ok: true, values: filter.values };
  }

  if (dataType === "number") {
    const numbers: number[] = [];
    // A number cannot contain a comma, so `in` also accepts the comma-separated spelling here.
    const raw = filter.operator === "in" ? filter.values.flatMap((value) => value.split(",")) : filter.values;
    for (const value of raw) {
      const parsed = parseNumber(value);
      if (parsed === null) return { ok: false, reason: `"${value}" is not a finite number.` };
      numbers.push(parsed);
    }
    if (numbers.length > V3_CONTACTS_MAX_IN_VALUES) {
      return {
        ok: false,
        reason: `At most ${String(V3_CONTACTS_MAX_IN_VALUES)} values are allowed per filter.`,
      };
    }
    return { ok: true, values: [...new Set(numbers)] };
  }

  const dates: Date[] = [];
  for (const value of filter.values) {
    if (!ZFilterDate.safeParse(value.trim()).success) {
      return { ok: false, reason: "Must be an ISO 8601 datetime with a UTC offset." };
    }
    dates.push(new Date(value.trim()));
  }
  return { ok: true, values: dates };
};

/**
 * Types every attribute filter against the workspace's keys. `keys` must already be scoped to the
 * authorized workspace — a key from another workspace must answer exactly like an unknown one.
 */
export function resolveV3ContactAttributeFilters(
  filters: readonly TV3RawAttributeFilter[],
  keys: readonly TAttributeKeyRef[]
): { ok: true; filters: TV3ContactAttributeFilter[] } | { ok: false; invalid_params: TV3InvalidParam[] } {
  const byKey = new Map(keys.map((key) => [key.key, key]));
  const resolved: TV3ContactAttributeFilter[] = [];
  const invalid: TV3InvalidParam[] = [];

  for (const filter of filters) {
    const attributeKey = byKey.get(filter.key);
    if (!attributeKey) {
      invalid.push({ name: filter.param, reason: `Unknown attribute key "${filter.key}".` });
      continue;
    }

    const allowed = OPERATORS_BY_DATA_TYPE[attributeKey.dataType];
    if (!allowed.includes(filter.operator)) {
      invalid.push({
        name: filter.param,
        reason: `Operator "${filter.operator}" is not supported for ${attributeKey.dataType} attributes. Use one of ${allowed.join(", ")}.`,
      });
      continue;
    }

    const typed = typeFilterValues(filter, attributeKey.dataType);
    if (!typed.ok) {
      invalid.push({ name: filter.param, reason: typed.reason });
      continue;
    }

    resolved.push({
      key: filter.key,
      attributeKeyId: attributeKey.id,
      dataType: attributeKey.dataType,
      operator: filter.operator,
      values: typed.values,
    } as TV3ContactAttributeFilter);
  }

  return invalid.length > 0 ? { ok: false, invalid_params: invalid } : { ok: true, filters: resolved };
}

/**
 * What the cursor is bound to: the authorized workspace, the search, the createdAt bounds and every
 * resolved attribute filter. `limit` and `includeTotalCount` stay out — a changed page size must be
 * honoured mid-walk; `sortBy` is bound by the cursor's own field.
 */
export function computeV3ContactsFingerprint(
  query: Pick<TV3ContactsListQuery, "workspaceId" | "search" | "createdAtGte" | "createdAtLte">,
  filters: readonly TV3ContactAttributeFilter[]
): string {
  const record: Record<string, unknown> = {
    workspaceId: query.workspaceId,
    search: query.search,
    createdAtGte: query.createdAtGte,
    createdAtLte: query.createdAtLte,
  };
  for (const filter of filters) {
    // Valueless operators still have to be in the binding, so they fingerprint as a marker.
    record[`attribute.${filter.key}.${filter.operator}`] = filter.values.length > 0 ? filter.values : "set";
  }
  return computeFilterFingerprint(record);
}

export function decodeV3ContactsCursor(
  raw: string | undefined,
  sortBy: TV3ContactsSort,
  fingerprint: string
): { ok: true; cursor: TKeysetCursor | null } | { ok: false; invalid_params: TV3InvalidParam[] } {
  if (!raw) return { ok: true, cursor: null };
  try {
    return {
      ok: true,
      cursor: decodeKeysetCursor(raw, { kind: CONTACTS_CURSOR_KIND, sortBy, fp: fingerprint }),
    };
  } catch (error) {
    return {
      ok: false,
      invalid_params: [
        { name: "cursor", reason: error instanceof Error ? error.message : "The cursor is invalid." },
      ],
    };
  }
}
