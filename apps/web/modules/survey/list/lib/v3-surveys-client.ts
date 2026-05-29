import type { TV3SurveyGenerateBody } from "@/app/api/v3/surveys/generate/schemas";
import type { TV3CreateSurveyBody, TV3SurveyValidationRequestBody } from "@/app/api/v3/surveys/schemas";
import { parseV3ApiError } from "@/modules/api/lib/v3-client";
import { normalizeSurveyFilters } from "@/modules/survey/list/lib/utils";
import { TSurveyListItem, TSurveyOverviewFilters } from "@/modules/survey/list/types/survey-overview";

type TV3SurveyListItemResponse = Omit<TSurveyListItem, "createdAt" | "publishOn" | "updatedAt"> & {
  createdAt: string;
  publishOn: string | null;
  updatedAt: string;
};

type TV3SurveyListResponse = {
  data: TV3SurveyListItemResponse[];
  meta: TSurveyListPage["meta"];
};

type TV3GenerateSurveyResponse = {
  data: {
    language: string;
    payload: TV3CreateSurveyBody;
    validation: TV3GeneratedSurveyValidationResponse;
  };
};

type TV3CreateSurveyResponse = {
  data: {
    id: string;
  };
};

export type TV3CreateSurveyValidationResponse = {
  valid: boolean;
  operation: "create";
  invalid_params: {
    name: string;
    reason: string;
  }[];
};

export type TV3GeneratedSurveyValidationResponse = {
  valid: boolean;
  invalid_params: {
    name: string;
    reason: string;
  }[];
  languages: {
    code: string;
    default: boolean;
    enabled: boolean;
  }[];
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
    publishOn: survey.publishOn ? new Date(survey.publishOn) : null,
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

export async function deleteSurvey(surveyId: string): Promise<void> {
  const response = await fetch(`/api/v3/surveys/${surveyId}`, {
    method: "DELETE",
    cache: "no-store",
  });

  if (!response.ok) {
    throw await parseV3ApiError(response);
  }
}

export async function generateSurveyCreatePayload(
  body: TV3SurveyGenerateBody
): Promise<TV3GenerateSurveyResponse["data"]> {
  const response = await fetch("/api/v3/surveys/generate", {
    method: "POST",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw await parseV3ApiError(response);
  }

  const responseBody = (await response.json()) as TV3GenerateSurveyResponse;
  return responseBody.data;
}

export async function validateSurveyCreatePayload(
  payload: TV3CreateSurveyBody
): Promise<TV3CreateSurveyValidationResponse> {
  const body: TV3SurveyValidationRequestBody = {
    operation: "create",
    data: payload,
  };

  const response = await fetch("/api/v3/surveys/validate", {
    method: "POST",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw await parseV3ApiError(response);
  }

  const responseBody = (await response.json()) as { data: TV3CreateSurveyValidationResponse };
  return responseBody.data;
}

export async function createV3Survey(payload: TV3CreateSurveyBody): Promise<TV3CreateSurveyResponse["data"]> {
  const response = await fetch("/api/v3/surveys", {
    method: "POST",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw await parseV3ApiError(response);
  }

  const responseBody = (await response.json()) as TV3CreateSurveyResponse;
  return responseBody.data;
}
