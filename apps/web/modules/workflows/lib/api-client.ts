import type {
  TCreateWorkflowInput,
  TPatchWorkflowInput,
  TWorkflowListItem,
  TWorkflowResource,
  TWorkflowRunListItem,
  TWorkflowRunResource,
  TWorkflowRunStatus,
  TWorkflowSortBy,
  TWorkflowStatus,
} from "@formbricks/workflows";
import { parseV3ApiError } from "@/modules/api/lib/v3-client";

const JSON_HEADERS = { "Content-Type": "application/json" };

// Bound mutation calls so a stalled request can't leave the editor's save/transition spinner
// stuck indefinitely; the rejection surfaces as the normal save/lifecycle error toast.
const MUTATION_TIMEOUT_MS = 15_000;

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
}: {
  workspaceId: string;
  limit: number;
  cursor?: string | null;
  filters?: TWorkflowListFilters;
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
  signal,
}: {
  workspaceId: string;
  limit: number;
  cursor?: string | null;
  filters?: TWorkflowListFilters;
  signal?: AbortSignal;
}): Promise<TWorkflowListPage> {
  const response = await fetch(
    `/api/v3/workflows?${buildWorkflowListSearchParams({ workspaceId, limit, cursor, filters }).toString()}`,
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
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw await parseV3ApiError(response);
  }

  const body = (await response.json()) as { data: TWorkflowResource };
  return body.data;
}

export async function getWorkflow(workflowId: string, signal?: AbortSignal): Promise<TWorkflowResource> {
  const response = await fetch(`/api/v3/workflows/${workflowId}`, {
    method: "GET",
    cache: "no-store",
    signal,
  });

  return readWorkflowResponse(response);
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
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(name ? { name } : {}),
  });

  if (!response.ok) {
    throw await parseV3ApiError(response);
  }

  const body = (await response.json()) as { data: TWorkflowResource };
  return body.data;
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
