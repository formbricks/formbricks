import type { TFunction } from "i18next";
import { resolveEnumFilter } from "@/modules/ui/components/table-toolbar/lib/enum-filters";
import { ENUM_RULE_OPERATORS } from "@/modules/ui/components/table-toolbar/lib/operators";
import type {
  TFilterProperty,
  TSortOption,
  TTableFilter,
} from "@/modules/ui/components/table-toolbar/lib/types";

const DATA_TYPES = ["string", "number", "date"] as const;
const ATTRIBUTE_TYPES = ["default", "custom"] as const;

export const ATTRIBUTE_SORT_VALUES = ["name", "-createdAt", "createdAt", "-updatedAt", "updatedAt"] as const;
export const DEFAULT_ATTRIBUTE_SORT = "name";

export const getAttributeSortOptions = (t: TFunction): TSortOption[] => [
  { value: "name", label: t("common.table_toolbar.sort_name") },
  { value: "-createdAt", label: t("common.table_toolbar.sort_recently_created") },
  { value: "createdAt", label: t("common.table_toolbar.sort_oldest_first") },
  { value: "-updatedAt", label: t("common.table_toolbar.sort_recently_updated") },
];

/** Attributes filter by data type and by Custom/Default (only custom attributes can be deleted). */
export const getAttributeFilterProperties = (t: TFunction): TFilterProperty[] => [
  {
    id: "dataType",
    label: t("common.table_toolbar.data_type"),
    valueType: "enum",
    quick: true,
    ruleOperators: ENUM_RULE_OPERATORS,
    options: [
      { value: "string", label: t("common.text") },
      { value: "number", label: t("common.number") },
      { value: "date", label: t("common.date") },
    ],
  },
  {
    id: "type",
    label: t("common.table_toolbar.attribute_type"),
    valueType: "enum",
    quick: true,
    ruleOperators: ENUM_RULE_OPERATORS,
    options: [
      { value: "custom", label: t("common.table_toolbar.type_custom") },
      { value: "default", label: t("common.table_toolbar.type_default") },
    ],
  },
];

/** The v3 contact-attribute-keys list parameters; null when the filters exclude every value. */
export const toAttributeListParams = (
  filters: readonly TTableFilter[],
  search: string,
  sortBy: string
): [string, string][] | null => {
  const dataTypes = resolveEnumFilter(filters, "dataType", DATA_TYPES);
  const types = resolveEnumFilter(filters, "type", ATTRIBUTE_TYPES);
  if (dataTypes?.length === 0 || types?.length === 0) return null;

  const params: [string, string][] = [];
  if (dataTypes && dataTypes.length < DATA_TYPES.length) {
    for (const value of dataTypes) params.push(["filter[dataType][in]", value]);
  }
  if (types && types.length < ATTRIBUTE_TYPES.length) {
    for (const value of types) params.push(["filter[type][in]", value]);
  }
  const trimmed = search.trim();
  if (trimmed) params.push(["search", trimmed]);
  params.push([
    "sortBy",
    (ATTRIBUTE_SORT_VALUES as readonly string[]).includes(sortBy) ? sortBy : DEFAULT_ATTRIBUTE_SORT,
  ]);
  return params;
};
