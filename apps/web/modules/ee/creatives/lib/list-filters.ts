import type { TFunction } from "i18next";
import type { CreativeDisplayStatusZodType, CreativeTypeZodType } from "@formbricks/api-v3-schemas";
import { resolveEnumFilter } from "@/modules/ui/components/table-toolbar/lib/enum-filters";
import { ENUM_RULE_OPERATORS } from "@/modules/ui/components/table-toolbar/lib/operators";
import type {
  TFilterProperty,
  TSortOption,
  TTableFilter,
} from "@/modules/ui/components/table-toolbar/lib/types";

// The list's filters and sort on the shared table toolbar, kept in the page URL like the surveys and
// workflows lists. The API does the filtering: with no status picked it leaves archived creatives out,
// so Show archived asks for archived on top of whatever else is picked.

export type TCreativeSortBy = "updatedAt" | "createdAt" | "name";

/** What `/api/v3/creatives` is asked for. */
export interface TCreativeListFilters {
  name: string;
  displayStatuses: CreativeDisplayStatusZodType[];
  types: CreativeTypeZodType[];
  sortBy: TCreativeSortBy;
}

export const INITIAL_CREATIVE_FILTERS: TCreativeListFilters = {
  name: "",
  displayStatuses: [],
  types: [],
  sortBy: "updatedAt",
};

const LIVE_STATUSES = [
  "draft",
  "scheduled",
  "active",
  "paused",
  "closed",
] as const satisfies readonly CreativeDisplayStatusZodType[];
const TYPES = ["feedbackButton", "banner"] as const satisfies readonly CreativeTypeZodType[];

export const SHOW_ARCHIVED_PROPERTY = "archived";
export const CREATIVE_SORT_VALUES: TCreativeSortBy[] = ["updatedAt", "createdAt", "name"];
export const DEFAULT_CREATIVE_SORT: TCreativeSortBy = "updatedAt";

export const getCreativeSortOptions = (t: TFunction): TSortOption[] => [
  { value: "updatedAt", label: t("common.updated_at") },
  { value: "createdAt", label: t("common.created_at") },
  { value: "name", label: t("workspace.surveys.alphabetical") },
];

/** Creatives filter by Status and Type; Show archived lives in the gear, like Surveys and Workflows. */
export const getCreativeFilterProperties = (t: TFunction): TFilterProperty[] => [
  {
    id: "status",
    label: t("common.status"),
    valueType: "enum",
    quick: true,
    ruleOperators: ENUM_RULE_OPERATORS,
    options: [
      { value: "draft", label: t("common.draft") },
      { value: "scheduled", label: t("common.scheduled") },
      { value: "active", label: t("common.active") },
      { value: "paused", label: t("common.paused") },
      { value: "closed", label: t("common.closed") },
    ],
  },
  {
    id: "type",
    label: t("common.type"),
    valueType: "enum",
    quick: true,
    ruleOperators: ENUM_RULE_OPERATORS,
    options: [
      { value: "feedbackButton", label: t("workspace.creatives.type_feedback_button") },
      { value: "banner", label: t("workspace.creatives.type_banner") },
    ],
  },
  {
    id: SHOW_ARCHIVED_PROPERTY,
    label: t("common.table_toolbar.show_archived"),
    valueType: "enum",
    hidden: true,
    options: [{ value: "true", label: t("common.table_toolbar.show_archived") }],
  },
];

export const isShowingArchived = (filters: readonly TTableFilter[]) =>
  filters.some((filter) => filter.property === SHOW_ARCHIVED_PROPERTY && filter.values.includes("true"));

export const setShowArchived = (filters: readonly TTableFilter[], show: boolean): TTableFilter[] => {
  const rest = filters.filter((filter) => filter.property !== SHOW_ARCHIVED_PROPERTY);
  return show ? [...rest, { property: SHOW_ARCHIVED_PROPERTY, operator: "in", values: ["true"] }] : rest;
};

/**
 * The toolbar's state as the API's filters. `null` means the filters exclude every status or every
 * type, so nothing can match and there is nothing to ask the API.
 */
export const toCreativeListFilters = (
  filters: readonly TTableFilter[],
  search: string,
  sortBy: string
): TCreativeListFilters | null => {
  const statuses = resolveEnumFilter(filters, "status", LIVE_STATUSES);
  const types = resolveEnumFilter(filters, "type", TYPES);
  if (statuses?.length === 0 || types?.length === 0) return null;
  const displayStatuses: CreativeDisplayStatusZodType[] = isShowingArchived(filters)
    ? [...(statuses ?? LIVE_STATUSES), "archived"]
    : (statuses ?? []);
  return {
    name: search.trim(),
    displayStatuses,
    types: types ?? [],
    sortBy: CREATIVE_SORT_VALUES.find((value) => value === sortBy) ?? DEFAULT_CREATIVE_SORT,
  };
};
