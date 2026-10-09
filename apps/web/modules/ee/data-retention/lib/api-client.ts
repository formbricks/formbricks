import { parseV3ApiError } from "@/modules/api/lib/v3-client";
import type {
  TCreateRetentionExemptionInput,
  TRetentionExemption,
  TRetentionExemptionSurveyOption,
  TRetentionPolicies,
  TRetentionPoliciesPatch,
  TRetentionRun,
  TSurveyRetention,
} from "../types";
import type { TRetentionHealthIssue } from "./health";

const BASE_PATH = "/api/internal/retention-runs";
const EXEMPTIONS_BASE_PATH = "/api/internal/retention-exemptions";
const POLICIES_BASE_PATH = "/api/internal/retention-policies";
const HEALTH_BASE_PATH = "/api/internal/retention-health";
const MUTATION_TIMEOUT_MS = 15_000;

export type TRetentionRunListPage = {
  data: TRetentionRun[];
  meta: { limit: number; nextCursor: string | null };
};

export type TRetentionRunListInput = {
  organizationId: string;
  /** Include runs that changed nothing. History hides them by default. */
  includeEmpty: boolean;
  limit: number;
};

export const buildRetentionRunsSearchParams = ({
  organizationId,
  includeEmpty,
  limit,
  cursor,
}: TRetentionRunListInput & { cursor: string | null }): URLSearchParams => {
  const params = new URLSearchParams({
    organizationId,
    limit: String(limit),
    includeEmpty: String(includeEmpty),
  });
  if (cursor) params.set("cursor", cursor);
  return params;
};

export async function listRetentionRuns({
  signal,
  ...input
}: TRetentionRunListInput & { cursor: string | null; signal?: AbortSignal }): Promise<TRetentionRunListPage> {
  const response = await fetch(`${BASE_PATH}?${buildRetentionRunsSearchParams(input)}`, {
    method: "GET",
    cache: "no-store",
    signal,
  });
  if (!response.ok) throw await parseV3ApiError(response);
  return (await response.json()) as TRetentionRunListPage;
}

/** The History CSV. A plain link: the browser downloads the streamed file itself. */
export const getRetentionExportUrl = (organizationId: string): string =>
  `${BASE_PATH}/export?${new URLSearchParams({ organizationId })}`;

export type TRetentionExemptionListPage = {
  data: TRetentionExemption[];
  meta: { limit: number; nextCursor: string | null };
};

export type TRetentionExemptionListInput = { organizationId: string; limit: number };

export const buildRetentionExemptionsSearchParams = ({
  organizationId,
  limit,
  cursor,
}: TRetentionExemptionListInput & { cursor: string | null }): URLSearchParams => {
  const params = new URLSearchParams({ organizationId, limit: String(limit) });
  if (cursor) params.set("cursor", cursor);
  return params;
};

export async function listRetentionExemptions({
  signal,
  ...input
}: TRetentionExemptionListInput & {
  cursor: string | null;
  signal?: AbortSignal;
}): Promise<TRetentionExemptionListPage> {
  const response = await fetch(`${EXEMPTIONS_BASE_PATH}?${buildRetentionExemptionsSearchParams(input)}`, {
    method: "GET",
    cache: "no-store",
    signal,
  });
  if (!response.ok) throw await parseV3ApiError(response);
  return (await response.json()) as TRetentionExemptionListPage;
}

export async function createRetentionExemption(
  input: TCreateRetentionExemptionInput
): Promise<TRetentionExemption> {
  const response = await fetch(EXEMPTIONS_BASE_PATH, {
    method: "POST",
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    signal: AbortSignal.timeout(MUTATION_TIMEOUT_MS),
  });
  if (!response.ok) throw await parseV3ApiError(response);
  return ((await response.json()) as { data: TRetentionExemption }).data;
}

export async function revokeRetentionExemption(exemptionId: string): Promise<TRetentionExemption> {
  const response = await fetch(`${EXEMPTIONS_BASE_PATH}/${encodeURIComponent(exemptionId)}/revoke`, {
    method: "POST",
    cache: "no-store",
    signal: AbortSignal.timeout(MUTATION_TIMEOUT_MS),
  });
  if (!response.ok) throw await parseV3ApiError(response);
  return ((await response.json()) as { data: TRetentionExemption }).data;
}

export type TRetentionExemptionSurveyOptionsInput = { organizationId: string; search: string };

/** Surveys for the Add exemption picker, searched by name on the server. */
export async function listRetentionExemptionSurveyOptions({
  organizationId,
  search,
  signal,
}: TRetentionExemptionSurveyOptionsInput & { signal?: AbortSignal }): Promise<
  TRetentionExemptionSurveyOption[]
> {
  const params = new URLSearchParams({ organizationId });
  if (search) params.set("search", search);
  const response = await fetch(`${EXEMPTIONS_BASE_PATH}/survey-options?${params}`, {
    method: "GET",
    cache: "no-store",
    signal,
  });
  if (!response.ok) throw await parseV3ApiError(response);
  return ((await response.json()) as { data: TRetentionExemptionSurveyOption[] }).data;
}

export type TRetentionHealth = { issues: TRetentionHealthIssue[]; smtpConfigured: boolean };

/** What can keep data retention from working for the organisation. Owners and managers only. */
export async function getRetentionHealth({
  organizationId,
  signal,
}: {
  organizationId: string;
  signal?: AbortSignal;
}): Promise<TRetentionHealth> {
  const response = await fetch(`${HEALTH_BASE_PATH}?${new URLSearchParams({ organizationId })}`, {
    method: "GET",
    cache: "no-store",
    signal,
  });
  if (!response.ok) throw await parseV3ApiError(response);
  return ((await response.json()) as { data: TRetentionHealth }).data;
}

export async function getRetentionPolicies({
  organizationId,
  signal,
}: {
  organizationId: string;
  signal?: AbortSignal;
}): Promise<TRetentionPolicies> {
  const response = await fetch(`${POLICIES_BASE_PATH}?${new URLSearchParams({ organizationId })}`, {
    method: "GET",
    cache: "no-store",
    signal,
  });
  if (!response.ok) throw await parseV3ApiError(response);
  return ((await response.json()) as { data: TRetentionPolicies }).data;
}

/** Change one policy; the response is the whole document. */
export async function updateRetentionPolicies({
  organizationId,
  patch,
}: {
  organizationId: string;
  patch: TRetentionPoliciesPatch;
}): Promise<TRetentionPolicies> {
  const response = await fetch(`${POLICIES_BASE_PATH}?${new URLSearchParams({ organizationId })}`, {
    method: "PATCH",
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
    signal: AbortSignal.timeout(MUTATION_TIMEOUT_MS),
  });
  if (!response.ok) throw await parseV3ApiError(response);
  return ((await response.json()) as { data: TRetentionPolicies }).data;
}

/** What data retention will do to one survey; `governed: false` when nothing will. */
export async function getSurveyRetention({
  surveyId,
  signal,
}: {
  surveyId: string;
  signal?: AbortSignal;
}): Promise<TSurveyRetention> {
  const response = await fetch(`/api/internal/survey-retention/${encodeURIComponent(surveyId)}`, {
    method: "GET",
    cache: "no-store",
    signal,
  });
  if (!response.ok) throw await parseV3ApiError(response);
  return ((await response.json()) as { data: TSurveyRetention }).data;
}
