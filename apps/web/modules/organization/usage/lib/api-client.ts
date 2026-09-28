import { parseV3ApiError } from "@/modules/api/lib/v3-client";
import type { TOrganizationUsage } from "../types/usage";
import type { TUsageRangeQuery } from "./range";

/** Client fetcher for the internal usage route. Forwards the TanStack `signal`. */
export async function getOrganizationUsage(params: {
  organizationId: string;
  range: TUsageRangeQuery;
  signal?: AbortSignal;
}): Promise<TOrganizationUsage> {
  const query = new URLSearchParams(
    params.range.preset
      ? { preset: params.range.preset }
      : { from: params.range.from ?? "", to: params.range.to ?? "" }
  );
  const response = await fetch(`/api/organizations/${params.organizationId}/usage?${query.toString()}`, {
    method: "GET",
    cache: "no-store",
    signal: params.signal,
  });
  if (!response.ok) {
    throw await parseV3ApiError(response);
  }
  return ((await response.json()) as { data: TOrganizationUsage }).data;
}
