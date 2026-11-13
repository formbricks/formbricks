import type {
  TAuthorizedMcpClientList,
  TMcpGrantResource,
} from "@/app/api/internal/mcp-grants/lib/serializers";
import { parseV3ApiError } from "@/modules/api/lib/v3-client";
import type { TMcpGrantAccessSelection, TMcpGrantPermissions } from "@/modules/mcp/grant";
import { toMcpGrantAccessRequest } from "@/modules/mcp/grant-access";

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

export async function getAuthorizedMcpClients(signal?: AbortSignal): Promise<TAuthorizedMcpClientList> {
  return request<TAuthorizedMcpClientList>(BASE_PATH, { method: "GET", signal });
}

export async function updateMcpGrant(params: {
  clientId: string;
  permissions: TMcpGrantPermissions;
  /** The organization & workspace access to set; omitted keeps the grant's. */
  access?: TMcpGrantAccessSelection;
}): Promise<TMcpGrantResource> {
  return request<TMcpGrantResource>(`${BASE_PATH}/${encodeURIComponent(params.clientId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      permissions: params.permissions,
      ...(params.access ? toMcpGrantAccessRequest(params.access) : {}),
    }),
    signal: AbortSignal.timeout(15_000),
  });
}

/** Revoke: ends the user's grant to the MCP client, its consent and its tokens. */
export async function revokeMcpGrant(clientId: string): Promise<void> {
  await request<{ clientId: string }>(`${BASE_PATH}/${encodeURIComponent(clientId)}`, {
    method: "DELETE",
    signal: AbortSignal.timeout(15_000),
  });
}
