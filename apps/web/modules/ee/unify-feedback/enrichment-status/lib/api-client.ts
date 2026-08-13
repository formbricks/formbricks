import { parseV3ApiError } from "@/modules/api/lib/v3-client";
import type { TEnrichmentStatusResponse } from "./enrichment";

/** Client fetcher for the enrichment-status v3 route. Forwards the TanStack `signal`. */
const ENDPOINT = "/api/v3/unify-feedback/enrichment-status";

export async function getEnrichmentStatus(params: {
  workspaceId: string;
  signal?: AbortSignal;
}): Promise<TEnrichmentStatusResponse> {
  const query = new URLSearchParams({ workspaceId: params.workspaceId });
  const response = await fetch(`${ENDPOINT}?${query.toString()}`, {
    method: "GET",
    cache: "no-store",
    signal: params.signal,
  });
  if (!response.ok) {
    throw await parseV3ApiError(response);
  }
  return ((await response.json()) as { data: TEnrichmentStatusResponse }).data;
}
