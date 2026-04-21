import { parseV3ApiError } from "@/modules/api/lib/v3-client";
import { normalizeSurveyFilters } from "@/modules/survey/list/lib/utils";
import { TSurveyListItem, TSurveyOverviewFilters } from "@/modules/survey/list/types/survey-overview";

type TV3SurveyListItemResponse = Omit<TSurveyListItem, "createdAt" | "updatedAt"> & {
  createdAt: string;
  updatedAt: string;
};

type TV3SurveyListResponse = {
  data: TV3SurveyListItemResponse[];
  meta: TSurveyListPage["meta"];
};

type TV3DeleteSurveyResponse = {
  data: {
    id: string;
  };
};

export type TSurveyListPage = {
  data: TSurveyListItem[];
  meta: {
    limit: number;
    nextCursor: string | null;
    totalCount: number | null;
  };
};

function mapSurveyListItem(survey: TV3SurveyListItemResponse): TSurveyListItem {
  return {
    ...survey,
    createdAt: new Date(survey.createdAt),
    updatedAt: new Date(survey.updatedAt),
  };
}

export function buildSurveyListSearchParams({
  workspaceId,
  limit,
  cursor,
  includeTotalCount,
  filters,
}: {
  workspaceId: string;
  limit: number;
  cursor?: string | null;
  includeTotalCount?: boolean;
  filters: TSurveyOverviewFilters;
}): URLSearchParams {
  const normalizedFilters = normalizeSurveyFilters(filters);
  const searchParams = new URLSearchParams();

  searchParams.set("workspaceId", workspaceId);
  searchParams.set("limit", String(limit));
  searchParams.set("sortBy", normalizedFilters.sortBy);

  if (cursor) {
    searchParams.set("cursor", cursor);
  }

  if (includeTotalCount === false) {
    searchParams.set("includeTotalCount", "false");
  }

  if (normalizedFilters.name) {
    searchParams.set("filter[name][contains]", normalizedFilters.name);
  }

  normalizedFilters.status.forEach((status) => {
    searchParams.append("filter[status][in]", status);
  });

  normalizedFilters.type.forEach((type) => {
    searchParams.append("filter[type][in]", type);
  });

  return searchParams;
}

export async function listSurveys({
  workspaceId,
  limit,
  cursor,
  includeTotalCount,
  filters,
  signal,
}: {
  workspaceId: string;
  limit: number;
  cursor?: string | null;
  includeTotalCount?: boolean;
  filters: TSurveyOverviewFilters;
  signal?: AbortSignal;
}): Promise<TSurveyListPage> {
  const response = await fetch(
    `/api/v3/surveys?${buildSurveyListSearchParams({
      workspaceId,
      limit,
      cursor,
      includeTotalCount,
      filters,
    }).toString()}`,
    {
      method: "GET",
      cache: "no-store",
      signal,
    }
  );

  if (!response.ok) {
    throw await parseV3ApiError(response);
  }

  const body = (await response.json()) as TV3SurveyListResponse;

  return {
    data: body.data.map(mapSurveyListItem),
    meta: body.meta,
  };
}

export async function deleteSurvey(surveyId: string): Promise<{ id: string }> {
  const response = await fetch(`/api/v3/surveys/${surveyId}`, {
    method: "DELETE",
    cache: "no-store",
  });

  if (!response.ok) {
    throw await parseV3ApiError(response);
  }

  const body = (await response.json()) as TV3DeleteSurveyResponse;
  return body.data;
}
