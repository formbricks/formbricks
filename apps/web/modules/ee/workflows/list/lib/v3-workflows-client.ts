import type { TWorkflowListItem } from "@formbricks/workflows";
import { parseV3ApiError } from "@/modules/api/lib/v3-client";

export interface TWorkflowListPage {
  data: TWorkflowListItem[];
  meta: { limit: number; nextCursor: string | null };
}

interface TV3WorkflowListResponse {
  data: TWorkflowListItem[];
  meta: TWorkflowListPage["meta"];
}

interface BuildSearchParamsArgs {
  workspaceId: string;
  limit: number;
  cursor?: string | null;
}

export function buildWorkflowListSearchParams({
  workspaceId,
  limit,
  cursor,
}: BuildSearchParamsArgs): URLSearchParams {
  const params = new URLSearchParams();
  params.set("workspaceId", workspaceId);
  params.set("limit", String(limit));
  if (cursor) params.set("cursor", cursor);
  return params;
}

interface ListWorkflowsArgs extends BuildSearchParamsArgs {
  signal?: AbortSignal;
}

export async function listWorkflows({
  workspaceId,
  limit,
  cursor,
  signal,
}: ListWorkflowsArgs): Promise<TWorkflowListPage> {
  const response = await fetch(
    `/api/v3/workflows?${buildWorkflowListSearchParams({ workspaceId, limit, cursor }).toString()}`,
    { method: "GET", cache: "no-store", signal }
  );

  if (!response.ok) {
    throw await parseV3ApiError(response);
  }

  const body = (await response.json()) as TV3WorkflowListResponse;
  return { data: body.data, meta: body.meta };
}
