import type { TSurveyStatus } from "@formbricks/types/surveys/types";
import type { TV3SurveyGenerateBody } from "@/app/api/v3/surveys/generate/schemas";
import type { TV3CreateSurveyBody, TV3SurveyValidationRequestBody } from "@/app/api/v3/surveys/schemas";
import { parseV3ApiError } from "@/modules/api/lib/v3-client";
import { normalizeSurveyFilters } from "@/modules/survey/list/lib/utils";
import { TSurveyListItem, TSurveyOverviewFilters } from "@/modules/survey/list/types/survey-overview";

type TV3SurveyListItemResponse = Omit<
  TSurveyListItem,
  "createdAt" | "publishOn" | "updatedAt" | "archivedAt"
> & {
  createdAt: string;
  publishOn: string | null;
  updatedAt: string;
  archivedAt: string | null;
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
    // Whether the workspace has any archived surveys. Only computed on the first
    // page (when includeTotalCount is not false); null on subsequent pages.
    hasArchived: boolean | null;
  };
};

function mapSurveyListItem(survey: TV3SurveyListItemResponse): TSurveyListItem {
  return {
    ...survey,
    createdAt: new Date(survey.createdAt),
    publishOn: survey.publishOn ? new Date(survey.publishOn) : null,
    updatedAt: new Date(survey.updatedAt),
    archivedAt: survey.archivedAt ? new Date(survey.archivedAt) : null,
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

type TV3UpdateSurveyStatusResponse = {
  data: {
    id: string;
    status: TSurveyStatus;
  };
};

export async function updateSurveyStatus(
  surveyId: string,
  status: TSurveyStatus
): Promise<{ id: string; status: TSurveyStatus }> {
  const response = await fetch(`/api/v3/surveys/${surveyId}`, {
    method: "PATCH",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ status }),
  });

  if (!response.ok) {
    throw await parseV3ApiError(response);
  }

  const responseBody = (await response.json()) as TV3UpdateSurveyStatusResponse;
  return responseBody.data;
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

type TV3ArchiveSurveyResponse = {
  data: {
    id: string;
    status: TSurveyStatus;
    archivedAt: string | null;
  };
};

export async function archiveSurvey(
  surveyId: string
): Promise<{ id: string; status: TSurveyStatus; archivedAt: string | null }> {
  const response = await fetch(`/api/v3/surveys/${surveyId}/archive`, {
    method: "POST",
    cache: "no-store",
  });

  if (!response.ok) {
    throw await parseV3ApiError(response);
  }

  const responseBody = (await response.json()) as TV3ArchiveSurveyResponse;
  return responseBody.data;
}

export async function restoreSurvey(
  surveyId: string
): Promise<{ id: string; status: TSurveyStatus; archivedAt: string | null }> {
  const response = await fetch(`/api/v3/surveys/${surveyId}/restore`, {
    method: "POST",
    cache: "no-store",
  });

  if (!response.ok) {
    throw await parseV3ApiError(response);
  }

  const responseBody = (await response.json()) as TV3ArchiveSurveyResponse;
  return responseBody.data;
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

export async function createV3Survey(
  payload: TV3CreateSurveyBody,
  createdFrom?: "blank" | "template" | "xm-template" | "ai"
): Promise<TV3CreateSurveyResponse["data"]> {
  const url = createdFrom
    ? `/api/v3/surveys?createdFrom=${encodeURIComponent(createdFrom)}`
    : "/api/v3/surveys";
  const response = await fetch(url, {
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
