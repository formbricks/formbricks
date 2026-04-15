import { normalizeSurveyFilters } from "@/modules/survey/list/lib/utils";
import { TSurveyListItem, TSurveyOverviewFilters } from "@/modules/survey/list/types/survey-overview";

export type TV3InvalidParam = {
  name: string;
  reason: string;
};

type TV3ProblemBody = {
  status?: number;
  detail?: string;
  code?: string;
  requestId?: string;
  invalid_params?: TV3InvalidParam[];
};

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
    totalCount: number;
  };
};

export class V3ApiError extends Error {
  status: number;
  code?: string;
  requestId?: string;
  invalid_params?: TV3InvalidParam[];

  constructor({
    status,
    detail,
    code,
    requestId,
    invalid_params,
  }: {
    status: number;
    detail: string;
    code?: string;
    requestId?: string;
    invalid_params?: TV3InvalidParam[];
  }) {
    super(detail);
    this.name = "V3ApiError";
    this.status = status;
    this.code = code;
    this.requestId = requestId;
    this.invalid_params = invalid_params;
  }

  get detail(): string {
    return this.message;
  }
}

export function getV3ApiErrorMessage(error: unknown, fallbackMessage: string): string {
  if (error instanceof V3ApiError) {
    return error.detail;
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallbackMessage;
}

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
  filters,
}: {
  workspaceId: string;
  limit: number;
  cursor?: string | null;
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

export async function parseV3ApiError(response: Response): Promise<V3ApiError> {
  let problemBody: TV3ProblemBody | undefined;

  try {
    problemBody = (await response.json()) as TV3ProblemBody;
  } catch {
    problemBody = undefined;
  }

  return new V3ApiError({
    status: problemBody?.status ?? response.status,
    detail: problemBody?.detail ?? response.statusText ?? "An unexpected error occurred.",
    code: problemBody?.code,
    requestId: problemBody?.requestId ?? response.headers.get("X-Request-Id") ?? undefined,
    invalid_params: problemBody?.invalid_params,
  });
}

export async function listSurveys({
  workspaceId,
  limit,
  cursor,
  filters,
  signal,
}: {
  workspaceId: string;
  limit: number;
  cursor?: string | null;
  filters: TSurveyOverviewFilters;
  signal?: AbortSignal;
}): Promise<TSurveyListPage> {
  const response = await fetch(
    `/api/v3/surveys?${buildSurveyListSearchParams({ workspaceId, limit, cursor, filters }).toString()}`,
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
