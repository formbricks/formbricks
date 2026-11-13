import type {
  TCreateWorkflowInput,
  TCreateWorkflowTestRunInput,
  TPatchWorkflowInput,
  TSendWorkflowTestRequestInput,
  TWorkflowListItem,
  TWorkflowResource,
  TWorkflowRunListItem,
  TWorkflowRunResource,
  TWorkflowRunStatus,
  TWorkflowSampleList,
  TWorkflowSampleResource,
  TWorkflowSortBy,
  TWorkflowStatus,
  TWorkflowTestRequestResult,
  TWorkflowWebhookResource,
} from "@formbricks/workflows";
import { parseV3ApiError } from "@/modules/api/lib/v3-client";

const JSON_HEADERS = { "Content-Type": "application/json" };

// Bound mutation calls so a stalled request can't leave the editor's save/transition spinner
// stuck indefinitely; the rejection surfaces as the normal save/lifecycle error toast.
export const MUTATION_TIMEOUT_MS = 15_000;

async function readWorkflowResponse(response: Response): Promise<TWorkflowResource> {
  if (!response.ok) {
    throw await parseV3ApiError(response);
  }

  const body = (await response.json()) as { data: TWorkflowResource };
  return body.data;
}

export interface TWorkflowListPage {
  data: TWorkflowListItem[];
  meta: {
    limit: number;
    nextCursor: string | null;
    // Workflows matching the filters; null unless the request asked for it (first page only).
    totalCount?: number | null;
  };
}

export interface TWorkflowListFilters {
  nameContains?: string;
  statusIn?: TWorkflowStatus[];
  sortBy?: TWorkflowSortBy;
}

export function buildWorkflowListSearchParams({
  workspaceId,
  limit,
  cursor,
  filters,
  includeTotalCount,
}: {
  workspaceId: string;
  limit: number;
  cursor?: string | null;
  filters?: TWorkflowListFilters;
  includeTotalCount?: boolean;
}): URLSearchParams {
  const searchParams = new URLSearchParams();

  searchParams.set("workspaceId", workspaceId);
  searchParams.set("limit", String(limit));

  if (filters?.sortBy) {
    searchParams.set("sortBy", filters.sortBy);
  }

  if (cursor) {
    searchParams.set("cursor", cursor);
  }

  if (includeTotalCount) {
    searchParams.set("includeTotalCount", "true");
  }

  const trimmedName = filters?.nameContains?.trim();
  if (trimmedName) {
    searchParams.set("filter[name][contains]", trimmedName);
  }

  filters?.statusIn?.forEach((status) => {
    searchParams.append("filter[status][in]", status);
  });

  return searchParams;
}

export async function listWorkflows({
  workspaceId,
  limit,
  cursor,
  filters,
  includeTotalCount,
  signal,
}: {
  workspaceId: string;
  limit: number;
  cursor?: string | null;
  filters?: TWorkflowListFilters;
  includeTotalCount?: boolean;
  signal?: AbortSignal;
}): Promise<TWorkflowListPage> {
  const response = await fetch(
    `/api/v3/workflows?${buildWorkflowListSearchParams({ workspaceId, limit, cursor, filters, includeTotalCount }).toString()}`,
    {
      method: "GET",
      cache: "no-store",
      signal,
    }
  );

  if (!response.ok) {
    throw await parseV3ApiError(response);
  }

  return (await response.json()) as TWorkflowListPage;
}

export async function createWorkflow(input: TCreateWorkflowInput): Promise<TWorkflowResource> {
  const response = await fetch("/api/v3/workflows", {
    method: "POST",
    cache: "no-store",
    headers: JSON_HEADERS,
    body: JSON.stringify(input),
    signal: AbortSignal.timeout(MUTATION_TIMEOUT_MS),
  });

  return readWorkflowResponse(response);
}

export async function getWorkflow(workflowId: string, signal?: AbortSignal): Promise<TWorkflowResource> {
  const response = await fetch(`/api/v3/workflows/${workflowId}`, {
    method: "GET",
    cache: "no-store",
    signal,
  });

  return readWorkflowResponse(response);
}

/**
 * The workflow's Webhook Secret URL, last call and Sample payload (with the Variables it offers).
 * Write access only: the URL is a credential (ADR 0041).
 */
export async function getWorkflowWebhook(
  workflowId: string,
  signal?: AbortSignal
): Promise<TWorkflowWebhookResource> {
  const response = await fetch(`/api/v3/workflows/${workflowId}/webhook`, {
    method: "GET",
    cache: "no-store",
    signal,
  });

  if (!response.ok) {
    throw await parseV3ApiError(response);
  }

  const body = (await response.json()) as { data: TWorkflowWebhookResource };
  return body.data;
}

export async function updateWorkflow(
  workflowId: string,
  payload: TPatchWorkflowInput
): Promise<TWorkflowResource> {
  const response = await fetch(`/api/v3/workflows/${workflowId}`, {
    method: "PATCH",
    cache: "no-store",
    headers: JSON_HEADERS,
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(MUTATION_TIMEOUT_MS),
  });

  return readWorkflowResponse(response);
}

export async function duplicateWorkflow(workflowId: string, name?: string): Promise<TWorkflowResource> {
  const response = await fetch(`/api/v3/workflows/${workflowId}/duplicate`, {
    method: "POST",
    cache: "no-store",
    headers: JSON_HEADERS,
    body: JSON.stringify(name ? { name } : {}),
    signal: AbortSignal.timeout(MUTATION_TIMEOUT_MS),
  });

  return readWorkflowResponse(response);
}

async function postLifecycle(workflowId: string, action: string): Promise<TWorkflowResource> {
  const response = await fetch(`/api/v3/workflows/${workflowId}/${action}`, {
    method: "POST",
    cache: "no-store",
    signal: AbortSignal.timeout(MUTATION_TIMEOUT_MS),
  });

  return readWorkflowResponse(response);
}

export const enableWorkflow = (workflowId: string) => postLifecycle(workflowId, "enable");
export const disableWorkflow = (workflowId: string) => postLifecycle(workflowId, "disable");
export const archiveWorkflow = (workflowId: string) => postLifecycle(workflowId, "archive");
export const unarchiveWorkflow = (workflowId: string) => postLifecycle(workflowId, "unarchive");

export async function deleteWorkflow(workflowId: string): Promise<void> {
  const response = await fetch(`/api/v3/workflows/${workflowId}`, {
    method: "DELETE",
    cache: "no-store",
    signal: AbortSignal.timeout(MUTATION_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw await parseV3ApiError(response);
  }
}

export interface TWorkflowRunListPage {
  data: TWorkflowRunListItem[];
  meta: {
    limit: number;
    nextCursor: string | null;
  };
}

export interface TWorkflowRunListFilters {
  workflowId?: string;
  responseId?: string;
  statusIn?: TWorkflowRunStatus[];
  isDryRun?: boolean;
}

export function buildWorkflowRunListSearchParams({
  workspaceId,
  limit,
  cursor,
  filters,
}: {
  workspaceId: string;
  limit: number;
  cursor?: string | null;
  filters?: TWorkflowRunListFilters;
}): URLSearchParams {
  const searchParams = new URLSearchParams();

  searchParams.set("workspaceId", workspaceId);
  searchParams.set("limit", String(limit));

  if (cursor) {
    searchParams.set("cursor", cursor);
  }

  if (filters?.workflowId) {
    searchParams.set("workflowId", filters.workflowId);
  }

  if (filters?.responseId) {
    searchParams.set("responseId", filters.responseId);
  }

  if (filters?.isDryRun !== undefined) {
    searchParams.set("filter[isDryRun][eq]", String(filters.isDryRun));
  }

  filters?.statusIn?.forEach((status) => {
    searchParams.append("filter[status][in]", status);
  });

  return searchParams;
}

export async function listWorkflowRuns({
  workspaceId,
  limit,
  cursor,
  filters,
  signal,
}: {
  workspaceId: string;
  limit: number;
  cursor?: string | null;
  filters?: TWorkflowRunListFilters;
  signal?: AbortSignal;
}): Promise<TWorkflowRunListPage> {
  const response = await fetch(
    `/api/v3/workflows/runs?${buildWorkflowRunListSearchParams({ workspaceId, limit, cursor, filters }).toString()}`,
    {
      method: "GET",
      cache: "no-store",
      signal,
    }
  );

  if (!response.ok) {
    throw await parseV3ApiError(response);
  }

  return (await response.json()) as TWorkflowRunListPage;
}

export async function getWorkflowRun(runId: string, signal?: AbortSignal): Promise<TWorkflowRunResource> {
  const response = await fetch(`/api/v3/workflows/runs/${runId}`, {
    method: "GET",
    cache: "no-store",
    signal,
  });

  if (!response.ok) {
    throw await parseV3ApiError(response);
  }

  const body = (await response.json()) as { data: TWorkflowRunResource };
  return body.data;
}

/**
 * Runs the workflow's draft at once with fake effects (a Test run, ADR 0049) and answers with the
 * finished run. Without `payload` the server uses the workflow's Sample payload.
 */
export async function createWorkflowTestRun(
  workflowId: string,
  input: TCreateWorkflowTestRunInput
): Promise<TWorkflowRunResource> {
  const response = await fetch(`/api/v3/workflows/${workflowId}/test-runs`, {
    method: "POST",
    cache: "no-store",
    headers: JSON_HEADERS,
    body: JSON.stringify(input),
    signal: AbortSignal.timeout(MUTATION_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw await parseV3ApiError(response);
  }

  const body = (await response.json()) as { data: TWorkflowRunResource };
  return body.data;
}
async function readDataResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw await parseV3ApiError(response);
  }
  const body = (await response.json()) as { data: T };
  return body.data;
}

/** The workflow's samples: the Sample payload and each HTTP request step's last Test request response. */
export async function listWorkflowSamples(
  workflowId: string,
  signal?: AbortSignal
): Promise<TWorkflowSampleList> {
  const response = await fetch(`/api/internal/workflows/${workflowId}/samples`, {
    method: "GET",
    cache: "no-store",
    signal,
  });
  return readDataResponse<TWorkflowSampleList>(response);
}

/** Replaces the Webhook Secret URL; the old one stops working at once. */
export async function regenerateWorkflowWebhook(workflowId: string): Promise<TWorkflowWebhookResource> {
  const response = await fetch(`/api/v3/workflows/${workflowId}/webhook/regenerate`, {
    method: "POST",
    cache: "no-store",
    signal: AbortSignal.timeout(MUTATION_TIMEOUT_MS),
  });
  return readDataResponse<TWorkflowWebhookResource>(response);
}

/** Replaces the Webhook trigger's Sample payload, e.g. with one pasted in the editor. */
export async function setWorkflowSample(
  workflowId: string,
  payload: Record<string, unknown>
): Promise<TWorkflowSampleResource> {
  const response = await fetch(`/api/v3/workflows/${workflowId}/sample`, {
    method: "PUT",
    cache: "no-store",
    headers: JSON_HEADERS,
    body: JSON.stringify({ payload }),
    signal: AbortSignal.timeout(MUTATION_TIMEOUT_MS),
  });
  return readDataResponse<TWorkflowSampleResource>(response);
}

/**
 * Replaces one stored secret header value in place (ADR 0043). For an enabled workflow, whose
 * definition can't be edited: the enabled workflow uses the new value from its next run.
 */
export async function replaceWorkflowSecretHeader(
  workflowId: string,
  stepId: string,
  headerName: string,
  value: string
): Promise<void> {
  const response = await fetch(
    `/api/internal/workflows/${workflowId}/steps/${encodeURIComponent(stepId)}/secret-headers/${encodeURIComponent(headerName)}`,
    {
      method: "PUT",
      cache: "no-store",
      headers: JSON_HEADERS,
      body: JSON.stringify({ value }),
      signal: AbortSignal.timeout(MUTATION_TIMEOUT_MS),
    }
  );
  if (!response.ok) {
    throw await parseV3ApiError(response);
  }
}

/** One real call of an HTTP request step ("Send test request"), from its draft settings. */
export async function sendWorkflowTestRequest(
  workflowId: string,
  stepId: string,
  input: TSendWorkflowTestRequestInput
): Promise<TWorkflowTestRequestResult> {
  const response = await fetch(
    `/api/v3/workflows/${workflowId}/steps/${encodeURIComponent(stepId)}/test-request`,
    {
      method: "POST",
      cache: "no-store",
      headers: JSON_HEADERS,
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(MUTATION_TIMEOUT_MS),
    }
  );
  return readDataResponse<TWorkflowTestRequestResult>(response);
}
