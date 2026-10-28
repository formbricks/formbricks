import type { TFunction } from "i18next";
import type { TContactAttributeKey } from "@formbricks/types/contact-attribute-key";
import { DATE_RANGE_PRESETS } from "@/lib/date-ranges";
import { resolveDateFilterBounds } from "@/modules/ui/components/table-toolbar/lib/date-filter";
import {
  DATE_RULE_OPERATORS,
  NUMBER_RULE_OPERATORS,
  STRING_RULE_OPERATORS,
} from "@/modules/ui/components/table-toolbar/lib/operators";
import type {
  TFilterOption,
  TFilterProperty,
  TSortOption,
  TTableFilter,
} from "@/modules/ui/components/table-toolbar/lib/types";

export const CONTACT_SORT_VALUES = ["-createdAt", "createdAt"] as const;
export const DEFAULT_CONTACT_SORT = "-createdAt";
export const ATTRIBUTE_PROPERTY_PREFIX = "attribute.";

export const getContactSortOptions = (t: TFunction): TSortOption[] => [
  { value: "-createdAt", label: t("common.table_toolbar.sort_newest_first") },
  { value: "createdAt", label: t("common.table_toolbar.sort_oldest_first") },
];

/**
 * Every contact attribute is a filter property (ENG-3542), with operators by its data type: text and
 * numbers tick values or take a rule, dates take a preset, a range or before/after. `loadAttributeValues`
 * fetches one attribute's distinct values, bounded on the server, when its value list opens.
 */
export const getContactFilterProperties = (
  t: TFunction,
  attributeKeys: readonly TContactAttributeKey[],
  loadAttributeValues: (key: string, search: string) => Promise<TFilterOption[]>
): TFilterProperty[] => [
  {
    id: "createdAt",
    label: t("common.created_at"),
    valueType: "date",
    quick: true,
    ruleOperators: ["isBefore", "isAfter"],
    datePresets: DATE_RANGE_PRESETS,
  },
  ...attributeKeys.map((attributeKey): TFilterProperty => {
    const id = `${ATTRIBUTE_PROPERTY_PREFIX}${attributeKey.key}`;
    const label = attributeKey.name ?? attributeKey.key;
    switch (attributeKey.dataType) {
      case "date":
        return { id, label, valueType: "date", quick: true, ruleOperators: DATE_RULE_OPERATORS };
      case "number":
        return {
          id,
          label,
          valueType: "number",
          quick: true,
          ruleOperators: NUMBER_RULE_OPERATORS,
          loadOptions: (search) => loadAttributeValues(attributeKey.key, search),
        };
      default:
        return {
          id,
          label,
          valueType: "string",
          quick: true,
          ruleOperators: STRING_RULE_OPERATORS,
          loadOptions: (search) => loadAttributeValues(attributeKey.key, search),
        };
    }
  }),
];

/** The toolbar's operator names as the v3 contacts list spells them (the shared v3 vocabulary). */
const API_OPERATORS: Readonly<Record<string, string>> = {
  equals: "eq",
  notEquals: "ne",
  doesNotContain: "notContains",
  greaterThan: "gt",
  greaterEqual: "gte",
  lessThan: "lt",
  lessEqual: "lte",
};
const SINGLE_VALUE_KEY = (property: string, operator: string) =>
  `filter[${property}][${API_OPERATORS[operator] ?? operator}]`;

const tightenDate = (bounds: Map<string, string>, key: string, iso: string, keep: "later" | "earlier") => {
  const current = bounds.get(key);
  if (current === undefined || (keep === "later" ? iso > current : iso < current)) bounds.set(key, iso);
};

const DATE_BOUND_OPERATORS = new Set(["preset", "between", "isBefore", "isAfter"]);

/** Folds a date filter into the tightest `gte`/`lte` pair; false when the filter is not a date bound. */
const addDateBounds = (
  dateBounds: Map<string, string>,
  filter: TTableFilter,
  timeZone: string,
  now: Date
): boolean => {
  const bounds = DATE_BOUND_OPERATORS.has(filter.operator)
    ? resolveDateFilterBounds(filter, timeZone, now)
    : null;
  if (!bounds) return false;
  if (bounds.from)
    tightenDate(dateBounds, SINGLE_VALUE_KEY(filter.property, "gte"), bounds.from.toISOString(), "later");
  if (bounds.to)
    tightenDate(dateBounds, SINGLE_VALUE_KEY(filter.property, "lte"), bounds.to.toISOString(), "earlier");
  return true;
};

/** Rules the API ANDs when the key is repeated, so every stacked rule is sent. */
const REPEATABLE_RULE_OPERATORS = new Set([
  "notEquals",
  "contains",
  "doesNotContain",
  "startsWith",
  "endsWith",
]);
/** Numeric bounds: stacked rules collapse to the tightest one. */
const LOWER_BOUND_OPERATORS = new Set(["greaterThan", "greaterEqual"]);
const UPPER_BOUND_OPERATORS = new Set(["lessThan", "lessEqual"]);

const tightestNumber = (operator: string, existing: string | undefined, value: string): string => {
  if (existing === undefined) return value;
  const [a, b] = [Number(existing), Number(value)];
  if (!Number.isFinite(a) || !Number.isFinite(b)) return value;
  if (LOWER_BOUND_OPERATORS.has(operator)) return b > a ? value : existing;
  return b < a ? value : existing;
};

/** Adds a non-date filter's parameter; false when it contradicts one already added. */
const addValueEntry = (entries: Map<string, string[]>, filter: TTableFilter): boolean => {
  const { property, operator, values } = filter;
  const key = SINGLE_VALUE_KEY(property, operator);
  const existing = entries.get(key);
  if (operator === "in") {
    const next = existing ? existing.filter((value) => values.includes(value)) : [...values];
    if (next.length === 0) return false;
    entries.set(key, next);
    return true;
  }
  if (operator === "isSet" || operator === "isNotSet") {
    entries.set(key, ["true"]);
    return true;
  }
  const [value] = values;
  if (REPEATABLE_RULE_OPERATORS.has(operator)) {
    entries.set(key, existing?.includes(value) ? existing : [...(existing ?? []), value]);
    return true;
  }
  if (LOWER_BOUND_OPERATORS.has(operator) || UPPER_BOUND_OPERATORS.has(operator)) {
    entries.set(key, [tightestNumber(operator, existing?.[0], value)]);
    return true;
  }
  if (operator === "equals" && existing && existing[0] !== value) return false;
  entries.set(key, [value]);
  return true;
};

const hasInvertedDateRange = (dateBounds: Map<string, string>): boolean => {
  for (const property of new Set([...dateBounds.keys()].map((key) => key.split("][")[0]))) {
    const from = dateBounds.get(`${property}][gte]`);
    const to = dateBounds.get(`${property}][lte]`);
    if (from && to && from > to) return true;
  }
  return false;
};

/**
 * The table's filters, search and sort as v3 contacts list parameters. Every stacked rule on one
 * attribute must hold: text rules of one kind (`contains a`, `contains b`) are all sent and the API
 * ANDs them; numeric and date bounds collapse to the tightest one; two rules that cannot both hold
 * (`is a` and `is b`) answer null — nothing can match.
 */
export const toContactListParams = (
  filters: readonly TTableFilter[],
  search: string,
  sortBy: string,
  timeZone: string,
  now: Date = new Date()
): [string, string][] | null => {
  const entries = new Map<string, string[]>();
  const dateBounds = new Map<string, string>();

  for (const filter of filters) {
    if (addDateBounds(dateBounds, filter, timeZone, now) || filter.property === "createdAt") continue;
    if (!addValueEntry(entries, filter)) return null;
  }

  for (const [key, value] of dateBounds) entries.set(key, [value]);
  if (hasInvertedDateRange(dateBounds)) return null;

  const params: [string, string][] = [];
  for (const [key, values] of entries) for (const value of values) params.push([key, value]);
  const trimmed = search.trim();
  if (trimmed) params.push(["search", trimmed]);
  params.push([
    "sortBy",
    (CONTACT_SORT_VALUES as readonly string[]).includes(sortBy) ? sortBy : DEFAULT_CONTACT_SORT,
  ]);
  return params;
};
