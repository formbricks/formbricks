import type { TSurveyVisibility } from "@formbricks/types/surveys/types";
import { TWorkspaceConfigChannel } from "@formbricks/types/workspace";
import { initialFilters } from "@/modules/survey/list/lib/constants";
import {
  TSurveyOverviewFilters,
  TSurveyOverviewSort,
  TSurveyOverviewType,
} from "@/modules/survey/list/types/survey-overview";

const allowedStatus = new Set(["draft", "inProgress", "paused", "completed", "archived"] as const);
const allowedType = new Set(["app", "link"] as const);
const allowedSort = new Set(["createdAt", "updatedAt", "name", "relevance"] as const);
const allowedVisibility = new Set(["restricted", "workspace"] as const);
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
  currentWorkspaceChannel?: TWorkspaceConfigChannel
): TSurveyOverviewType[] {
  if (currentWorkspaceChannel === "link" || !Array.isArray(value)) {
    return [];
  }

  return [
    ...new Set(value.filter((type): type is TSurveyOverviewType => allowedType.has(type as never))),
  ].sort(compareNormalizedFilterValues);
}

export function getNormalizedVisibility(value: unknown): TSurveyVisibility[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return [
    ...new Set(
      value.filter((visibility): visibility is TSurveyVisibility =>
        allowedVisibility.has(visibility as never)
      )
    ),
  ].sort(compareNormalizedFilterValues);
}

function getNormalizedSort(value: unknown): TSurveyOverviewSort {
  return allowedSort.has(value as never) ? (value as TSurveyOverviewSort) : initialFilters.sortBy;
}

export function normalizeSurveyFilters(
  filters: Partial<TSurveyOverviewFilters> | null | undefined,
  currentWorkspaceChannel?: TWorkspaceConfigChannel
): TSurveyOverviewFilters {
  return {
    name: typeof filters?.name === "string" ? filters.name.trim() : initialFilters.name,
    status: getNormalizedStatus(filters?.status),
    type: getNormalizedType(filters?.type, currentWorkspaceChannel),
    visibility: getNormalizedVisibility(filters?.visibility),
    sortBy: getNormalizedSort(filters?.sortBy),
  };
}

/** Read the remembered filters; a stored `visibility` is dropped (see `serializeStoredSurveyFilters`). */
export function parseStoredSurveyFilters(
  storedValue: string | null,
  currentWorkspaceChannel?: TWorkspaceConfigChannel
): TSurveyOverviewFilters | null {
  if (!storedValue) {
    return null;
  }

  try {
    const { visibility: _visibility, ...stored } = JSON.parse(storedValue) as Partial<TSurveyOverviewFilters>;
    return normalizeSurveyFilters(stored, currentWorkspaceChannel);
  } catch {
    return null;
  }
}

/**
 * The remembered filters. `visibility` is left out: it is not remembered between visits (ENG-3395), so a
 * filter set on one visit can never hide colleagues' surveys on the next one without being on screen.
 */
export function serializeStoredSurveyFilters(filters: TSurveyOverviewFilters): string {
  const { visibility: _visibility, ...remembered } = filters;
  return JSON.stringify(remembered);
}
