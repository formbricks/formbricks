import { parseV3ApiError } from "@/modules/api/lib/v3-client";
import type {
  FeedbackRecordData,
  TaxonomyFieldOption,
  TaxonomyNode,
  TaxonomyNodeRecordCount,
  TaxonomyRun,
  TaxonomyScopeType,
  TaxonomyTreeResponse,
} from "@/modules/hub/types";

/**
 * Client fetchers for the Unify Feedback taxonomy v3 routes. Reads forward the TanStack `signal`;
 * mutations use a 15s timeout. Every call throws a parsed `V3ApiError` on a non-2xx response.
 */

const BASE_PATH = "/api/v3/unify-feedback/taxonomy";
const MUTATION_TIMEOUT_MS = 15_000;

export type TTaxonomyFieldsResponse = {
  fields: TaxonomyFieldOption[];
  unavailable: boolean;
  unavailableMessage?: string;
};

export type TTaxonomyStateResponse = {
  activeTree: TaxonomyTreeResponse | null;
  runs: TaxonomyRun[];
  unavailable: boolean;
  unavailableMessage?: string;
};

export type TTriggerRunResponse = {
  run: TaxonomyRun;
  inProgress: boolean;
};

export type TNodeRecordsResponse = {
  records: FeedbackRecordData[];
  limit: number;
};

async function getData<T>(url: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, { method: "GET", cache: "no-store", signal });
  if (!response.ok) {
    throw await parseV3ApiError(response);
  }
  return ((await response.json()) as { data: T }).data;
}

export async function getTaxonomyFields(params: {
  workspaceId: string;
  directoryId: string;
  signal?: AbortSignal;
}): Promise<TTaxonomyFieldsResponse> {
  const query = new URLSearchParams({
    workspaceId: params.workspaceId,
    directoryId: params.directoryId,
  });
  return getData<TTaxonomyFieldsResponse>(`${BASE_PATH}/fields?${query.toString()}`, params.signal);
}

export async function getTaxonomyState(params: {
  workspaceId: string;
  directoryId: string;
  scopeType: TaxonomyScopeType;
  sourceType?: string;
  sourceId?: string;
  fieldId?: string;
  signal?: AbortSignal;
}): Promise<TTaxonomyStateResponse> {
  const query = new URLSearchParams({
    workspaceId: params.workspaceId,
    directoryId: params.directoryId,
    scopeType: params.scopeType,
  });
  if (params.scopeType === "field") {
    query.set("sourceType", params.sourceType ?? "");
    // sourceId may be the empty "no source" bucket — URLSearchParams still emits `sourceId=`.
    query.set("sourceId", params.sourceId ?? "");
    query.set("fieldId", params.fieldId ?? "");
  }
  return getData<TTaxonomyStateResponse>(`${BASE_PATH}/state?${query.toString()}`, params.signal);
}

export async function getTaxonomyRun(params: {
  workspaceId: string;
  directoryId: string;
  runId: string;
  signal?: AbortSignal;
}): Promise<TaxonomyRun> {
  const query = new URLSearchParams({
    workspaceId: params.workspaceId,
    directoryId: params.directoryId,
  });
  return getData<TaxonomyRun>(
    `${BASE_PATH}/runs/${encodeURIComponent(params.runId)}?${query.toString()}`,
    params.signal
  );
}

export async function getTaxonomyRecordCounts(params: {
  workspaceId: string;
  directoryId: string;
  runId: string;
  signal?: AbortSignal;
}): Promise<TaxonomyNodeRecordCount[]> {
  const query = new URLSearchParams({
    workspaceId: params.workspaceId,
    directoryId: params.directoryId,
  });
  const data = await getData<{ counts: TaxonomyNodeRecordCount[] }>(
    `${BASE_PATH}/runs/${encodeURIComponent(params.runId)}/record-counts?${query.toString()}`,
    params.signal
  );
  return data.counts;
}

export async function getTaxonomyNodeRecords(params: {
  workspaceId: string;
  directoryId: string;
  nodeId: string;
  limit: number;
  signal?: AbortSignal;
}): Promise<TNodeRecordsResponse> {
  const query = new URLSearchParams({
    workspaceId: params.workspaceId,
    directoryId: params.directoryId,
    limit: String(params.limit),
  });
  const response = await fetch(
    `${BASE_PATH}/nodes/${encodeURIComponent(params.nodeId)}/records?${query.toString()}`,
    { method: "GET", cache: "no-store", signal: params.signal }
  );
  if (!response.ok) {
    throw await parseV3ApiError(response);
  }
  const body = (await response.json()) as { data: FeedbackRecordData[]; meta: { limit: number } };
  return { records: body.data, limit: body.meta.limit };
}

export async function triggerTaxonomyRun(params: {
  workspaceId: string;
  directoryId: string;
  scopeType: TaxonomyScopeType;
  sourceType?: string;
  sourceId?: string;
  fieldId?: string;
  fieldLabel?: string;
}): Promise<TTriggerRunResponse> {
  const body = {
    workspaceId: params.workspaceId,
    directoryId: params.directoryId,
    scopeType: params.scopeType,
    ...(params.scopeType === "field"
      ? { sourceType: params.sourceType, sourceId: params.sourceId, fieldId: params.fieldId }
      : {}),
    ...(params.fieldLabel !== undefined ? { fieldLabel: params.fieldLabel } : {}),
  };
  const response = await fetch(`${BASE_PATH}/runs`, {
    method: "POST",
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(MUTATION_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw await parseV3ApiError(response);
  }
  return ((await response.json()) as { data: TTriggerRunResponse }).data;
}

export async function renameTaxonomyNode(params: {
  workspaceId: string;
  directoryId: string;
  nodeId: string;
  label: string;
}): Promise<TaxonomyNode> {
  const response = await fetch(`${BASE_PATH}/nodes/${encodeURIComponent(params.nodeId)}`, {
    method: "PATCH",
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      workspaceId: params.workspaceId,
      directoryId: params.directoryId,
      label: params.label,
    }),
    signal: AbortSignal.timeout(MUTATION_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw await parseV3ApiError(response);
  }
  return ((await response.json()) as { data: TaxonomyNode }).data;
}

export async function removeTaxonomyNode(params: {
  workspaceId: string;
  directoryId: string;
  nodeId: string;
}): Promise<void> {
  const query = new URLSearchParams({
    workspaceId: params.workspaceId,
    directoryId: params.directoryId,
  });
  const response = await fetch(
    `${BASE_PATH}/nodes/${encodeURIComponent(params.nodeId)}?${query.toString()}`,
    { method: "DELETE", cache: "no-store", signal: AbortSignal.timeout(MUTATION_TIMEOUT_MS) }
  );
  if (!response.ok) {
    throw await parseV3ApiError(response);
  }
}
