import type { TDateRangePreset } from "@/lib/date-ranges";

/**
 * The one operator list every table filters with (ADR 0015). A table offers a subset per filter
 * property; its adapter maps each one onto its backend.
 *
 * - `in`: a quick filter. The row matches any of the ticked values.
 * - `preset` / `between`: a date quick filter. `between` holds two calendar days (`yyyy-MM-dd`); the URL
 *   writes them as `gte` / `lte`.
 * - The rest are Advanced filter rules. `includesOneOf` / `includesAllOf` hold a list of values (a
 *   multi-select question's choices); every other rule holds one value or none.
 */
export const TABLE_FILTER_OPERATORS = [
  "in",
  "preset",
  "between",
  "equals",
  "notEquals",
  "contains",
  "doesNotContain",
  "startsWith",
  "doesNotStartWith",
  "endsWith",
  "doesNotEndWith",
  "greaterThan",
  "greaterEqual",
  "lessThan",
  "lessEqual",
  "isBefore",
  "isAfter",
  "isSet",
  "isNotSet",
  "includesOneOf",
  "includesAllOf",
] as const;

export type TTableFilterOperator = (typeof TABLE_FILTER_OPERATORS)[number];

/** Operators produced by quick filters (ticked values, a date preset or a date range). */
export type TQuickFilterOperator = Extract<TTableFilterOperator, "in" | "preset" | "between">;

/** Operators an Advanced filter rule can use. */
export type TRuleOperator = Exclude<TTableFilterOperator, TQuickFilterOperator>;

/** One active filter: one filter chip. Every active filter on a table must match (AND). */
export type TTableFilter = {
  property: string;
  operator: TTableFilterOperator;
  /** Empty for `isSet` / `isNotSet`; one for most rules; any number for `in`; two for `between`. */
  values: string[];
};

export type TFilterValueType = "string" | "number" | "date" | "enum";

export type TFilterOption = {
  label: string;
  value: string;
};

/**
 * Something a table can be filtered by (GLOSSARY: Filter property). A table publishes a list of these;
 * a filter on a property that is not in the list is dropped when the URL is read.
 */
export type TFilterProperty = {
  id: string;
  label: string;
  valueType: TFilterValueType;
  /** Shown in the Filter menu as a quick filter: an enum with a value list, or a date with presets. */
  quick?: boolean;
  /** Fixed values for an enum quick filter. */
  options?: TFilterOption[];
  /**
   * Values worth offering while a free-text rule is typed (values already seen). Unlike `options`
   * they never limit what the rule may hold.
   */
  suggestions?: readonly string[];
  /** Values loaded on demand, for value lists too long or too dynamic to ship with the page. */
  loadOptions?: (search: string) => Promise<TFilterOption[]>;
  /** Heading the property sits under in Advanced filter's picker. Absent: the table's one list. */
  group?: string;
  /** Operators offered in Advanced filter. Empty or absent: the property is not offered there. */
  ruleOperators?: TRuleOperator[];
  /** Date quick filters only: the presets offered, in order. */
  datePresets?: readonly TDateRangePreset[];
  /**
   * A view switch kept in the URL like any filter (Show archived), set from the gear rather than the
   * Filter menu: it never shows as a chip and does not count towards `Filter (n)`.
   */
  hidden?: boolean;
};

export type TSortOption = {
  value: string;
  label: string;
};
