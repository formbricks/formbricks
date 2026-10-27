import { DATE_RANGE_PRESETS, type TDateRangePreset } from "@/lib/date-ranges";
import { operatorTakesValue, operatorTakesValues } from "./operators";
import {
  TABLE_FILTER_OPERATORS,
  type TFilterProperty,
  type TTableFilter,
  type TTableFilterOperator,
} from "./types";

// Active filters live in the page URL in the v3 query syntax, `filter[<property>][<operator>]=<value>`
// (ADR 0003). A multi-value filter repeats the key rather than joining values with commas, because a
// value — a contact attribute, a source name — may itself hold a comma. Search and sort sit beside
// them as `search` and `sortBy`.

export const SEARCH_PARAM = "search";
export const SORT_PARAM = "sortBy";

const FILTER_KEY_PATTERN = /^filter\[([^\]]+)\]\[([^\]]+)\]$/;
const CALENDAR_DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Most values one filter keeps; anything beyond is a hand-edited URL, not a user ticking boxes. */
export const MAX_FILTER_VALUES = 100;
/** Most filters one table keeps. */
export const MAX_FILTERS = 50;

const isOperator = (value: string): value is TTableFilterOperator =>
  (TABLE_FILTER_OPERATORS as readonly string[]).includes(value);

/** `last 7 days` ↔ `last_7_days`: presets keep their meaning in a URL without encoded spaces. */
export const datePresetToSlug = (preset: TDateRangePreset): string => preset.replaceAll(" ", "_");

export const datePresetFromSlug = (slug: string): TDateRangePreset | null => {
  const preset = slug.replaceAll("_", " ");
  return (DATE_RANGE_PRESETS as readonly string[]).includes(preset) ? (preset as TDateRangePreset) : null;
};

export const isCalendarDay = (value: string): boolean => {
  if (!CALENDAR_DAY_PATTERN.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
};

/** The operators a property accepts from a URL: its quick filter forms plus its rule operators. */
export const getAllowedOperators = (property: TFilterProperty): TTableFilterOperator[] => {
  const allowed = new Set<TTableFilterOperator>(property.ruleOperators ?? []);
  if (property.quick || property.hidden) {
    if (property.valueType === "date") {
      allowed.add("preset");
      allowed.add("between");
    } else {
      allowed.add("in");
    }
  }
  return [...allowed];
};

const isValidValue = (property: TFilterProperty, operator: TTableFilterOperator, value: string): boolean => {
  if (value.length === 0 || value.length > 500) return false;
  if (operator === "preset") return datePresetFromSlug(value) !== null;
  if (property.valueType === "date") return isCalendarDay(value);
  if (property.valueType === "number" && operator !== "in") return Number.isFinite(Number(value));
  if (property.valueType === "enum" && property.options && !property.loadOptions) {
    return property.options.some((option) => option.value === value);
  }
  return true;
};

const normalizeFilter = (property: TFilterProperty, filter: TTableFilter): TTableFilter | null => {
  const validValues = filter.values.filter((value) => isValidValue(property, filter.operator, value));
  const values = [...new Set(validValues)];

  if (!operatorTakesValue(filter.operator)) return { ...filter, values: [] };
  if (filter.operator === "between") {
    // A one-day range has the same day twice, so this reads the values before de-duplicating them.
    if (validValues.length !== 2) return null;
    const [from, to] = validValues;
    return from <= to ? { ...filter, values: [from, to] } : { ...filter, values: [to, from] };
  }
  if (filter.operator === "in" || operatorTakesValues(filter.operator)) {
    return values.length > 0 ? { ...filter, values: values.slice(0, MAX_FILTER_VALUES) } : null;
  }
  return values.length > 0 ? { ...filter, values: [values[0]] } : null;
};

type TDateRange = { gte?: string; lte?: string };

const isQuickDateBound = (property: TFilterProperty, operator: string): operator is keyof TDateRange =>
  property.valueType === "date" && !!property.quick && (operator === "gte" || operator === "lte");

/** The filters one `filter[<property>][<operator>]` key holds, or none when the property does not take it. */
const parseKeyFilters = (property: TFilterProperty, operator: string, values: string[]): TTableFilter[] => {
  if (!isOperator(operator) || operator === "between") return [];
  if (!getAllowedOperators(property).includes(operator)) return [];

  // Rules stack: "Status is not Draft" and "Status is not Paused" share a key, so every value but a
  // list operator's is its own rule. Without that, the second rule would vanish on the next read.
  const holdsList = operator === "in" || operatorTakesValues(operator) || !operatorTakesValue(operator);
  const valueGroups = holdsList ? [values] : [...new Set(values)].map((v) => [v]);
  return valueGroups
    .map((group) => normalizeFilter(property, { property: property.id, operator, values: group }))
    .filter((filter): filter is TTableFilter => filter !== null);
};

/** A quick date property's `gte`/`lte` pair as one `between` filter. */
const parseDateRangeFilter = (
  property: TFilterProperty | undefined,
  range: TDateRange,
  filters: readonly TTableFilter[]
): TTableFilter | null => {
  if (!property || !range.gte || !range.lte) return null;
  // A preset already on the property wins: a property carries one date quick filter.
  if (filters.some((filter) => filter.property === property.id && filter.operator === "preset")) return null;
  return normalizeFilter(property, {
    property: property.id,
    operator: "between",
    values: [range.gte, range.lte],
  });
};

/**
 * Reads the active filters out of a URL. Anything a table does not publish — an unknown property, an
 * operator the property does not take, a value outside its list — is dropped rather than reported:
 * a stale or hand-edited link should show the list it can, not an error.
 */
export const parseTableFilters = (
  searchParams: Pick<URLSearchParams, "getAll" | "keys">,
  properties: readonly TFilterProperty[]
): TTableFilter[] => {
  const propertyById = new Map(properties.map((property) => [property.id, property]));
  const filters: TTableFilter[] = [];
  const dateRanges = new Map<string, TDateRange>();

  for (const key of new Set(searchParams.keys())) {
    const match = FILTER_KEY_PATTERN.exec(key);
    if (!match) continue;
    const [, propertyId, operator] = match;
    const property = propertyById.get(propertyId);
    if (!property) continue;
    const values = searchParams.getAll(key);

    if (isQuickDateBound(property, operator)) {
      const range = dateRanges.get(propertyId) ?? {};
      range[operator] = values[0];
      dateRanges.set(propertyId, range);
      continue;
    }
    filters.push(...parseKeyFilters(property, operator, values));
  }

  for (const [propertyId, range] of dateRanges) {
    const filter = parseDateRangeFilter(propertyById.get(propertyId), range, filters);
    if (filter) filters.push(filter);
  }

  return filters.slice(0, MAX_FILTERS);
};

/** The `[key, value]` pairs a list of filters writes to a URL, in a stable order. */
export const serializeTableFilters = (filters: readonly TTableFilter[]): [string, string][] => {
  const entries: [string, string][] = [];
  for (const filter of filters) {
    if (filter.operator === "between") {
      entries.push(
        [`filter[${filter.property}][gte]`, filter.values[0]],
        [`filter[${filter.property}][lte]`, filter.values[1]]
      );
      continue;
    }
    if (!operatorTakesValue(filter.operator)) {
      entries.push([`filter[${filter.property}][${filter.operator}]`, "true"]);
      continue;
    }
    for (const value of filter.values) {
      entries.push([`filter[${filter.property}][${filter.operator}]`, value]);
    }
  }
  return entries;
};

/** Writes filters, search and sort into a copy of `current`, keeping every unrelated parameter. */
export const buildTableSearchParams = (
  current: URLSearchParams,
  state: { filters: readonly TTableFilter[]; search: string; sortBy: string | null }
): URLSearchParams => {
  const next = new URLSearchParams();
  for (const [key, value] of current) {
    if (FILTER_KEY_PATTERN.test(key) || key === SEARCH_PARAM || key === SORT_PARAM) continue;
    next.append(key, value);
  }
  for (const [key, value] of serializeTableFilters(state.filters)) next.append(key, value);
  const search = state.search.trim();
  if (search) next.set(SEARCH_PARAM, search);
  if (state.sortBy) next.set(SORT_PARAM, state.sortBy);
  return next;
};
