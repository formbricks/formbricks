import type { TMcpConnectionList, TMcpGrantResource } from "@/app/api/internal/mcp-grants/lib/serializers";
import { parseV3ApiError } from "@/modules/api/lib/v3-client";
import type { TMcpGrantPermissions } from "@/modules/mcp/grant";

/**
 * Client fetchers for Authorized apps' grant routes. Reads forward the TanStack `signal`; every call throws
 * a parsed `V3ApiError` on a non-2xx response, so the dialog can show the server's own message.
 */

const BASE_PATH = "/api/internal/mcp-grants";

async function request<T>(url: string, init: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: "no-store", ...init });
  if (!response.ok) {
    throw await parseV3ApiError(response);
  }
  return ((await response.json()) as { data: T }).data;
}

export async function getMcpConnections(signal?: AbortSignal): Promise<TMcpConnectionList> {
  return request<TMcpConnectionList>(BASE_PATH, { method: "GET", signal });
}

export async function updateMcpGrant(params: {
  clientId: string;
  permissions: TMcpGrantPermissions;
}): Promise<TMcpGrantResource> {
  return request<TMcpGrantResource>(`${BASE_PATH}/${encodeURIComponent(params.clientId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ permissions: params.permissions }),
    signal: AbortSignal.timeout(15_000),
  });
}
