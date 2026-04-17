import { TProjectConfigChannel } from "@formbricks/types/project";
import { initialFilters } from "@/modules/survey/list/lib/constants";
import {
  TSurveyOverviewFilters,
  TSurveyOverviewSort,
  TSurveyOverviewType,
} from "@/modules/survey/list/types/survey-overview";

const allowedStatus = new Set(["draft", "inProgress", "paused", "completed"] as const);
const allowedType = new Set(["app", "link"] as const);
const allowedSort = new Set(["createdAt", "updatedAt", "name", "relevance"] as const);
const compareNormalizedFilterValues = (left: string, right: string) => left.localeCompare(right);

function getNormalizedStatus(value: unknown): TSurveyOverviewFilters["status"] {
  if (!Array.isArray(value)) {
    return [];
  }

  return [
    ...new Set(
      value.filter((status): status is TSurveyOverviewFilters["status"][number] =>
        allowedStatus.has(status as never)
      )
    ),
  ].sort(compareNormalizedFilterValues);
}

function getNormalizedType(
  value: unknown,
  currentProjectChannel?: TProjectConfigChannel
): TSurveyOverviewType[] {
  if (currentProjectChannel === "link" || !Array.isArray(value)) {
    return [];
  }

  return [
    ...new Set(value.filter((type): type is TSurveyOverviewType => allowedType.has(type as never))),
  ].sort(compareNormalizedFilterValues);
}

function getNormalizedSort(value: unknown): TSurveyOverviewSort {
  return allowedSort.has(value as never) ? (value as TSurveyOverviewSort) : initialFilters.sortBy;
}

export function normalizeSurveyFilters(
  filters: Partial<TSurveyOverviewFilters> | null | undefined,
  currentProjectChannel?: TProjectConfigChannel
): TSurveyOverviewFilters {
  return {
    name: typeof filters?.name === "string" ? filters.name.trim() : initialFilters.name,
    status: getNormalizedStatus(filters?.status),
    type: getNormalizedType(filters?.type, currentProjectChannel),
    sortBy: getNormalizedSort(filters?.sortBy),
  };
}

export function parseStoredSurveyFilters(
  storedValue: string | null,
  currentProjectChannel?: TProjectConfigChannel
): TSurveyOverviewFilters | null {
  if (!storedValue) {
    return null;
  }

  try {
    return normalizeSurveyFilters(
      JSON.parse(storedValue) as Partial<TSurveyOverviewFilters>,
      currentProjectChannel
    );
  } catch {
    return null;
  }
}

export function hasActiveSurveyFilters(filters: TSurveyOverviewFilters): boolean {
  return Boolean(filters.name) || filters.status.length > 0 || filters.type.length > 0;
}
