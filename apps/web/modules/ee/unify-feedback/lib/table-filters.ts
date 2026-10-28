import type { TFunction } from "i18next";
import { DATE_RANGE_PRESETS } from "@/lib/date-ranges";
import { resolveDateFilterBounds } from "@/modules/ui/components/table-toolbar/lib/date-filter";
import { resolveEnumFilter } from "@/modules/ui/components/table-toolbar/lib/enum-filters";
import type {
  TFilterOption,
  TFilterProperty,
  TSortOption,
  TTableFilter,
} from "@/modules/ui/components/table-toolbar/lib/types";
import { SOURCE_TYPE_PRESET_OPTIONS } from "./types";
import { formatFieldTypeLabel, formatSourceType } from "./utils";

export const FIELD_TYPES = [
  "text",
  "categorical",
  "nps",
  "csat",
  "ces",
  "rating",
  "number",
  "boolean",
  "date",
] as const;
export const SENTIMENTS = [
  "very_negative",
  "negative",
  "neutral",
  "positive",
  "very_positive",
  "mixed",
] as const;
export const EMOTIONS = ["joy", "anger", "sadness", "fear", "surprise", "disgust"] as const;
const SOURCE_TYPES = ["formbricks", "csv", ...SOURCE_TYPE_PRESET_OPTIONS] as const;

export const RECORD_SORT_VALUES = ["-collectedAt", "collectedAt", "-importedAt", "importedAt"] as const;
export type TRecordSort = (typeof RECORD_SORT_VALUES)[number];
export const DEFAULT_RECORD_SORT: TRecordSort = "-collectedAt";

export const getRecordSortOptions = (t: TFunction): TSortOption[] => [
  { value: "-collectedAt", label: t("workspace.unify.sort_newest_collected") },
  { value: "collectedAt", label: t("workspace.unify.sort_oldest_collected") },
  { value: "-importedAt", label: t("workspace.unify.sort_newest_imported") },
  { value: "importedAt", label: t("workspace.unify.sort_oldest_imported") },
];

const getSentimentLabel = (value: (typeof SENTIMENTS)[number], t: TFunction): string => {
  switch (value) {
    case "very_negative":
      return t("workspace.unify.taxonomy_sentiment_very_negative");
    case "negative":
      return t("workspace.unify.taxonomy_sentiment_negative");
    case "neutral":
      return t("workspace.unify.taxonomy_sentiment_neutral");
    case "positive":
      return t("workspace.unify.taxonomy_sentiment_positive");
    case "very_positive":
      return t("workspace.unify.taxonomy_sentiment_very_positive");
    default:
      return t("workspace.unify.taxonomy_sentiment_mixed");
  }
};

const getEmotionLabel = (value: (typeof EMOTIONS)[number], t: TFunction): string => {
  switch (value) {
    case "joy":
      return t("workspace.analysis.charts.emotion_value_joy");
    case "anger":
      return t("workspace.analysis.charts.emotion_value_anger");
    case "sadness":
      return t("workspace.analysis.charts.emotion_value_sadness");
    case "fear":
      return t("workspace.analysis.charts.emotion_value_fear");
    case "surprise":
      return t("workspace.analysis.charts.emotion_value_surprise");
    default:
      return t("workspace.analysis.charts.emotion_value_disgust");
  }
};

/**
 * What Feedback Records filter by (ENG-3536 decisions): source type, source, collected date, field
 * type, sentiment and emotion as quick filters; numeric and date values, sentiment score, import date,
 * language and user as Advanced filter rules. Each maps onto one Hub list filter, which has no "not"
 * filters — so only the enums with a closed value list offer "is not".
 */
export const getRecordFilterProperties = (
  t: TFunction,
  { sourceNames }: { sourceNames: readonly string[] }
): TFilterProperty[] => {
  const sourceOptions: TFilterOption[] = [...new Set(sourceNames)]
    .sort((a, b) => a.localeCompare(b))
    .map((name) => ({ value: name, label: name }));

  return [
    {
      id: "sourceType",
      label: t("workspace.unify.source_type"),
      valueType: "enum",
      quick: true,
      ruleOperators: ["equals"],
      options: SOURCE_TYPES.map((value) => ({ value, label: formatSourceType(value, t) })),
    },
    {
      id: "source",
      label: t("workspace.unify.source_name"),
      valueType: "enum",
      quick: sourceOptions.length > 0,
      // With no source names to pick from, a rule could never be completed: offer none.
      ruleOperators: sourceOptions.length > 0 ? ["equals"] : [],
      options: sourceOptions,
    },
    {
      id: "collectedAt",
      label: t("workspace.unify.collected_at"),
      valueType: "date",
      quick: true,
      ruleOperators: ["isBefore", "isAfter"],
      datePresets: DATE_RANGE_PRESETS,
    },
    {
      id: "fieldType",
      label: t("workspace.unify.field_type"),
      valueType: "enum",
      quick: true,
      ruleOperators: ["equals", "notEquals"],
      options: FIELD_TYPES.map((value) => ({ value, label: formatFieldTypeLabel(value, t) })),
    },
    {
      id: "sentiment",
      label: t("workspace.unify.taxonomy_sentiment_label"),
      valueType: "enum",
      quick: true,
      ruleOperators: ["equals", "notEquals"],
      options: SENTIMENTS.map((value) => ({ value, label: getSentimentLabel(value, t) })),
    },
    {
      id: "emotion",
      label: t("workspace.unify.taxonomy_emotion_label"),
      valueType: "enum",
      quick: true,
      ruleOperators: ["equals"],
      options: EMOTIONS.map((value) => ({ value, label: getEmotionLabel(value, t) })),
    },
    {
      id: "valueNumber",
      label: t("workspace.unify.number_value"),
      valueType: "number",
      ruleOperators: ["greaterEqual", "lessEqual"],
    },
    {
      id: "valueDate",
      label: t("workspace.unify.date_value"),
      valueType: "date",
      ruleOperators: ["isBefore", "isAfter"],
    },
    {
      id: "sentimentScore",
      label: t("workspace.unify.sentiment_score"),
      valueType: "number",
      ruleOperators: ["greaterEqual", "lessEqual"],
    },
    {
      id: "importedAt",
      label: t("workspace.unify.imported_at"),
      valueType: "date",
      ruleOperators: ["isBefore", "isAfter"],
    },
    {
      id: "language",
      label: t("common.language"),
      valueType: "string",
      ruleOperators: ["equals"],
    },
    {
      id: "userId",
      label: t("workspace.unify.user_identifier"),
      valueType: "string",
      ruleOperators: ["equals"],
    },
  ];
};

/** Hub list query parameters: repeatable ones as arrays, the rest as single strings. */
export type THubRecordQuery = Record<string, string | string[]>;

/** Each `in` / `equals` filter on a property as the set of values it allows. */
const collectValueSets = (filters: readonly TTableFilter[], property: string): Set<string>[] =>
  filters
    .filter((filter) => filter.property === property)
    .filter((filter) => filter.operator === "in" || filter.operator === "equals")
    .map((filter) => new Set(filter.operator === "equals" ? filter.values.slice(0, 1) : filter.values));

/** For single-valued fields: several filters on one property intersect. */
const collectEquals = (filters: readonly TTableFilter[], property: string): string[] | null => {
  const valueSets = collectValueSets(filters, property);
  if (valueSets.length === 0) return null;
  const [first, ...rest] = valueSets;
  return [...first].filter((value) => rest.every((set) => set.has(value)));
};

/**
 * For emotions, which are multi-label: a record carrying joy *and* anger matches both `is joy` and
 * `is anger`, so intersecting the rules (as for a single-valued field) would wrongly match nothing.
 * The Hub's `emotions` filter only matches "carries any of", with no "carries all" form, so the
 * narrowest rule is sent. That is exact when one rule's values sit inside every other's, and otherwise
 * a superset — it never hides a record that matches every rule.
 */
const collectAnyOf = (filters: readonly TTableFilter[], property: string): string[] | null => {
  const [first, ...rest] = collectValueSets(filters, property);
  if (!first) return null;
  return [...rest.reduce((narrowest, set) => (set.size < narrowest.size ? set : narrowest), first)];
};

/** The Hub stores a language tag of at most 10 characters, so a longer one matches no record. */
const LANGUAGE_MAX_LENGTH = 10;
const collectLanguages = (filters: readonly TTableFilter[]): string[] | null =>
  collectEquals(filters, "language")
    ?.map((value) => value.trim())
    .filter((value) => value.length > 0 && value.length <= LANGUAGE_MAX_LENGTH) ?? null;

const pickBound = (current: string | undefined, next: string, keep: "max" | "min"): string => {
  if (current === undefined) return next;
  const pickLater = keep === "max";
  return next > current === pickLater ? next : current;
};

const tightenNumber = (
  query: THubRecordQuery,
  key: string,
  value: number,
  pick: (a: number, b: number) => number
) => {
  query[key] = String(query[key] === undefined ? value : pick(Number(query[key]), value));
};

/**
 * Folds a property's `≥` / `≤` rules into the tightest pair. With a `range` (the values the field can
 * hold, which the Hub also enforces on the bound), a bound outside it is clamped to its edge rather than
 * sent and rejected — `≥ -5` still means "has a score" — and one that no value can meet answers false:
 * nothing matches.
 */
const applyNumberBounds = (
  query: THubRecordQuery,
  filters: readonly TTableFilter[],
  property: string,
  minKey: string,
  maxKey: string,
  range?: { min: number; max: number }
): boolean => {
  for (const filter of filters.filter((f) => f.property === property)) {
    const raw = Number(filter.values[0]);
    if (!Number.isFinite(raw)) continue;
    const value = range ? Math.min(range.max, Math.max(range.min, raw)) : raw;
    if (filter.operator === "greaterEqual") {
      if (raw > value) return false;
      tightenNumber(query, minKey, value, Math.max);
    }
    if (filter.operator === "lessEqual") {
      if (raw < value) return false;
      tightenNumber(query, maxKey, value, Math.min);
    }
  }
  return true;
};

/** Hub sentiment scores lie in [-1, 1]. */
const SENTIMENT_SCORE_RANGE = { min: -1, max: 1 };

const applyDateBounds = (
  query: THubRecordQuery,
  filters: readonly TTableFilter[],
  property: string,
  fromKey: string,
  toKey: string,
  timeZone: string,
  now: Date
) => {
  for (const filter of filters.filter((f) => f.property === property)) {
    const bounds = resolveDateFilterBounds(filter, timeZone, now);
    if (!bounds) continue;
    // ISO strings in UTC compare correctly as text, so the tightest bound is a string comparison.
    if (bounds.from)
      query[fromKey] = pickBound(query[fromKey] as string | undefined, bounds.from.toISOString(), "max");
    if (bounds.to)
      query[toKey] = pickBound(query[toKey] as string | undefined, bounds.to.toISOString(), "min");
  }
};

/**
 * Writes every list filter to the query; false when one of them excludes every value. "Formbricks
 * surveys" is stored as `formbricks` by older connectors and `formbricks_survey` by newer ones; the
 * filter offers it once and asks for both.
 */
const applyListFilters = (query: THubRecordQuery, filters: readonly TTableFilter[]): boolean => {
  const sourceTypes = collectEquals(filters, "sourceType")?.flatMap((value) =>
    value === "formbricks" ? ["formbricks", "formbricks_survey"] : [value]
  );
  const lists: [string, string[] | null][] = [
    ["source_type", sourceTypes ?? null],
    ["source_name", collectEquals(filters, "source")],
    ["language", collectLanguages(filters)],
    ["user_id", collectEquals(filters, "userId")],
    ["emotions", collectAnyOf(filters, "emotion")],
    ["field_type", resolveEnumFilter(filters, "fieldType", FIELD_TYPES)],
    ["sentiment", resolveEnumFilter(filters, "sentiment", SENTIMENTS)],
  ];
  for (const [key, values] of lists) {
    if (values === null) continue;
    if (values.length === 0) return false;
    query[key] = values;
  }
  return true;
};

const DATE_RANGE_KEYS = [
  ["since", "until"],
  ["created_since", "created_until"],
  ["value_date_min", "value_date_max"],
] as const;
const NUMBER_RANGE_KEYS = [
  ["value_number_min", "value_number_max"],
  ["sentiment_score_min", "sentiment_score_max"],
] as const;

/** True when some lower bound sits above its upper bound, so no record can match. */
const hasEmptyRange = (query: THubRecordQuery): boolean =>
  DATE_RANGE_KEYS.some(
    ([minKey, maxKey]) => query[minKey] && query[maxKey] && query[minKey] > query[maxKey]
  ) ||
  NUMBER_RANGE_KEYS.some(
    ([minKey, maxKey]) => query[minKey] && query[maxKey] && Number(query[minKey]) > Number(query[maxKey])
  );

/**
 * The table's filters and sort as Hub list parameters (the v3 feedbackRecords list and count take the
 * Hub's query unchanged). Returns null when the filters exclude every value of some property, so the
 * table answers empty without asking the Hub.
 */
export const toHubRecordQuery = (
  filters: readonly TTableFilter[],
  sortBy: string,
  timeZone: string,
  now: Date = new Date()
): THubRecordQuery | null => {
  const query: THubRecordQuery = {};
  if (!applyListFilters(query, filters)) return null;

  applyDateBounds(query, filters, "collectedAt", "since", "until", timeZone, now);
  applyDateBounds(query, filters, "importedAt", "created_since", "created_until", timeZone, now);
  applyDateBounds(query, filters, "valueDate", "value_date_min", "value_date_max", timeZone, now);
  applyNumberBounds(query, filters, "valueNumber", "value_number_min", "value_number_max");
  const sentimentScoreCanMatch = applyNumberBounds(
    query,
    filters,
    "sentimentScore",
    "sentiment_score_min",
    "sentiment_score_max",
    SENTIMENT_SCORE_RANGE
  );
  if (!sentimentScoreCanMatch || hasEmptyRange(query)) return null;

  const sort = (RECORD_SORT_VALUES as readonly string[]).includes(sortBy) ? sortBy : DEFAULT_RECORD_SORT;
  query.sort = sort.endsWith("importedAt") ? "created_at" : "collected_at";
  query.order = sort.startsWith("-") ? "desc" : "asc";

  return query;
};

/** Appends a Hub query to URL parameters, repeating the key for each value of a list filter. */
export const appendHubQuery = (params: URLSearchParams, query: THubRecordQuery) => {
  for (const [key, value] of Object.entries(query)) {
    if (Array.isArray(value)) {
      for (const item of value) params.append(key, item);
    } else {
      params.set(key, value);
    }
  }
};
