import type { TFunction } from "i18next";
import type { TSurveyVisibility } from "@formbricks/types/surveys/types";
import type { TWorkspaceConfigChannel } from "@formbricks/types/workspace";
import type {
  TSurveyOverviewFilters,
  TSurveyOverviewOwner,
  TSurveyOverviewSort,
  TSurveyOverviewStatus,
  TSurveyOverviewType,
} from "@/modules/survey/list/types/survey-overview";
import { resolveEnumFilter } from "@/modules/ui/components/table-toolbar/lib/enum-filters";
import { ENUM_RULE_OPERATORS } from "@/modules/ui/components/table-toolbar/lib/operators";
import type {
  TFilterProperty,
  TSortOption,
  TTableFilter,
} from "@/modules/ui/components/table-toolbar/lib/types";

const SURVEY_STATUSES = ["draft", "inProgress", "paused", "completed"] as const;
const SURVEY_TYPES: TSurveyOverviewType[] = ["link", "app"];
const SURVEY_OWNERS: TSurveyOverviewOwner[] = ["me", "others"];
const SURVEY_VISIBILITIES: TSurveyVisibility[] = ["restricted", "workspace"];

export const SHOW_ARCHIVED_PROPERTY = "archived";
export const SURVEY_SORT_VALUES: TSurveyOverviewSort[] = ["relevance", "updatedAt", "createdAt", "name"];
export const DEFAULT_SURVEY_SORT: TSurveyOverviewSort = "relevance";

export const getSurveySortOptions = (t: TFunction): TSortOption[] => [
  { value: "relevance", label: t("workspace.surveys.relevance") },
  { value: "updatedAt", label: t("common.updated_at") },
  { value: "createdAt", label: t("common.created_at") },
  { value: "name", label: t("workspace.surveys.alphabetical") },
];

/** What the Survey list can be filtered by (ENG-3536 decisions: Status, Type, Owner, Visibility). */
export const getSurveyFilterProperties = (
  t: TFunction,
  { channel, isVisibilityEnabled }: { channel: TWorkspaceConfigChannel; isVisibilityEnabled: boolean }
): TFilterProperty[] => {
  const properties: TFilterProperty[] = [
    {
      id: "status",
      label: t("common.status"),
      valueType: "enum",
      quick: true,
      ruleOperators: ENUM_RULE_OPERATORS,
      options: [
        { value: "draft", label: t("common.draft") },
        { value: "inProgress", label: t("common.in_progress") },
        { value: "paused", label: t("common.paused") },
        { value: "completed", label: t("common.closed") },
      ],
    },
  ];

  // A link-only workspace has nothing but link surveys, so a type filter would be a one-value list.
  if (channel !== "link") {
    properties.push({
      id: "type",
      label: t("common.type"),
      valueType: "enum",
      quick: true,
      ruleOperators: ENUM_RULE_OPERATORS,
      options: [
        { value: "link", label: t("common.link") },
        { value: "app", label: t("common.app") },
      ],
    });
  }

  properties.push({
    id: "owner",
    label: t("common.table_toolbar.owner"),
    valueType: "enum",
    quick: true,
    ruleOperators: ENUM_RULE_OPERATORS,
    options: [
      { value: "me", label: t("common.table_toolbar.owner_me") },
      { value: "others", label: t("common.table_toolbar.owner_others") },
    ],
  });

  // ENG-3395: the Visibility filter exists only while restricted surveys are switched on.
  if (isVisibilityEnabled) {
    properties.push({
      id: "visibility",
      label: t("common.visibility"),
      valueType: "enum",
      quick: true,
      ruleOperators: ENUM_RULE_OPERATORS,
      options: [
        { value: "restricted", label: t("workspace.surveys.visibility.restricted") },
        { value: "workspace", label: t("common.workspace") },
      ],
    });
  }

  properties.push({
    id: SHOW_ARCHIVED_PROPERTY,
    label: t("common.table_toolbar.show_archived"),
    valueType: "enum",
    hidden: true,
    options: [{ value: "true", label: t("common.table_toolbar.show_archived") }],
  });

  return properties;
};

export const isShowingArchived = (filters: readonly TTableFilter[]) =>
  filters.some((filter) => filter.property === SHOW_ARCHIVED_PROPERTY && filter.values.includes("true"));

export const setShowArchived = (filters: readonly TTableFilter[], show: boolean): TTableFilter[] => {
  const rest = filters.filter((filter) => filter.property !== SHOW_ARCHIVED_PROPERTY);
  return show ? [...rest, { property: SHOW_ARCHIVED_PROPERTY, operator: "in", values: ["true"] }] : rest;
};

/**
 * The table's filters, search and sort as the v3 surveys list query. Returns null when the filters
 * exclude every value of some property (Status is Draft and Status is not Draft): nothing can match,
 * so the list answers empty without a request.
 *
 * Show archived adds the `archived` pseudo-status. With no status picked, every real status goes along
 * with it, because `archived` on its own means "archived only" to the API.
 */
export const toSurveyListFilters = (
  filters: readonly TTableFilter[],
  search: string,
  sortBy: string
): TSurveyOverviewFilters | null => {
  const status = resolveEnumFilter(filters, "status", SURVEY_STATUSES);
  const type = resolveEnumFilter(filters, "type", SURVEY_TYPES);
  const owner = resolveEnumFilter(filters, "owner", SURVEY_OWNERS);
  const visibility = resolveEnumFilter(filters, "visibility", SURVEY_VISIBILITIES);

  if ([status, type, owner, visibility].some((values) => values?.length === 0)) return null;

  let statusFilter: TSurveyOverviewStatus[] = status ?? [];
  if (isShowingArchived(filters)) {
    statusFilter = [...(status ?? SURVEY_STATUSES), "archived"];
  }

  return {
    name: search.trim(),
    status: statusFilter,
    // Both types ticked is the same as no type filter.
    type: type && type.length < SURVEY_TYPES.length ? type : [],
    owner: owner && owner.length < SURVEY_OWNERS.length ? owner : [],
    visibility: visibility && visibility.length < SURVEY_VISIBILITIES.length ? visibility : [],
    sortBy: (SURVEY_SORT_VALUES as string[]).includes(sortBy)
      ? (sortBy as TSurveyOverviewSort)
      : DEFAULT_SURVEY_SORT,
  };
};
