import type { TFunction } from "i18next";
import type { TWorkflowSortBy, TWorkflowStatus } from "@formbricks/workflows";
import { resolveEnumFilter } from "@/modules/ui/components/table-toolbar/lib/enum-filters";
import { isHiddenToggleOn, setHiddenToggle } from "@/modules/ui/components/table-toolbar/lib/hidden-toggle";
import { ENUM_RULE_OPERATORS } from "@/modules/ui/components/table-toolbar/lib/operators";
import type {
  TFilterProperty,
  TSortOption,
  TTableFilter,
} from "@/modules/ui/components/table-toolbar/lib/types";

const LIVE_STATUSES = ["draft", "enabled", "disabled"] as const satisfies readonly TWorkflowStatus[];

export const SHOW_ARCHIVED_PROPERTY = "archived";
export const WORKFLOW_SORT_VALUES: TWorkflowSortBy[] = ["updatedAt", "createdAt", "name"];
export const DEFAULT_WORKFLOW_SORT: TWorkflowSortBy = "updatedAt";

export const getWorkflowSortOptions = (t: TFunction): TSortOption[] => [
  { value: "updatedAt", label: t("common.updated_at") },
  { value: "createdAt", label: t("common.created_at") },
  { value: "name", label: t("workspace.workflows.alphabetical") },
];

/** Workflows filter by Status; Show archived lives in the gear (ENG-3536 decisions). */
export const getWorkflowFilterProperties = (t: TFunction): TFilterProperty[] => [
  {
    id: "status",
    label: t("common.status"),
    valueType: "enum",
    quick: true,
    ruleOperators: ENUM_RULE_OPERATORS,
    options: [
      { value: "draft", label: t("common.draft") },
      { value: "enabled", label: t("common.enabled") },
      { value: "disabled", label: t("common.disabled") },
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
  isHiddenToggleOn(filters, SHOW_ARCHIVED_PROPERTY);

export const setShowArchived = (filters: readonly TTableFilter[], show: boolean): TTableFilter[] =>
  setHiddenToggle(filters, SHOW_ARCHIVED_PROPERTY, show);

/**
 * The statuses to ask the API for. `undefined` is the API default (every live status, archived hidden);
 * null means the filters exclude every status and nothing can match. Show archived adds archived on
 * top of whatever is picked — with nothing picked, on top of every live status.
 */
export const toWorkflowStatusIn = (
  filters: readonly TTableFilter[]
): TWorkflowStatus[] | undefined | null => {
  const statuses = resolveEnumFilter(filters, "status", LIVE_STATUSES);
  if (statuses?.length === 0) return null;
  if (isShowingArchived(filters)) return [...(statuses ?? LIVE_STATUSES), "archived"];
  return statuses ?? undefined;
};
