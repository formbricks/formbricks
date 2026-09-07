import type { TV3Tag } from "@/app/api/v3/tags/serializers";
import { parseV3ApiError } from "@/modules/api/lib/v3-client";

/**
 * Client fetchers for the tags v3 routes. Reads forward the TanStack `signal`; every call throws a parsed
 * `V3ApiError` on a non-2xx response, so the hooks can surface the server's own message.
 */

const BASE_PATH = "/api/v3/tags";

async function request<T>(url: string, init: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: "no-store", ...init });
  if (!response.ok) {
    throw await parseV3ApiError(response);
  }
  return ((await response.json()) as { data: T }).data;
}

export async function getTags(params: { workspaceId: string; signal?: AbortSignal }): Promise<TV3Tag[]> {
  const query = new URLSearchParams({ workspaceId: params.workspaceId });
  return request<TV3Tag[]>(`${BASE_PATH}?${query.toString()}`, {
    method: "GET",
    signal: params.signal,
  });
}

export async function renameTag(params: { tagId: string; name: string }): Promise<TV3Tag> {
  return request<TV3Tag>(`${BASE_PATH}/${params.tagId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: params.name }),
  });
}

export async function deleteTag(params: { tagId: string }): Promise<{ id: string }> {
  return request<{ id: string }>(`${BASE_PATH}/${params.tagId}`, { method: "DELETE" });
}

export async function mergeTags(params: { tagId: string; newTagId: string }): Promise<{ id: string }> {
  return request<{ id: string }>(`${BASE_PATH}/${params.tagId}/merge`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ newTagId: params.newTagId }),
  });
}
