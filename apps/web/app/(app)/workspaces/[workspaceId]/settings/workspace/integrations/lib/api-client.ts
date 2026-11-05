import type { TIntegrationByType, TIntegrationType } from "@formbricks/types/integration";
import { parseV3ApiError } from "@/modules/api/lib/v3-client";

type TIntegrationWithData = { config: { data: { createdAt: Date | string }[] } };

/**
 * JSON carries each mapping's `createdAt` as a string, but the integration schemas type it as a `Date` —
 * and the mapping UI echoes every mapping back to `createOrUpdateIntegrationAction`, whose `z.date()`
 * would reject a string. Revive it here so the query cache holds the same shape the server page passes.
 */
export const reviveIntegrationDates = <T extends TIntegrationWithData>(integration: T): T => ({
  ...integration,
  config: {
    ...integration.config,
    data: integration.config.data.map((mapping) => ({ ...mapping, createdAt: new Date(mapping.createdAt) })),
  },
});

/** Client fetcher for the internal integration route. Forwards the TanStack `signal`. */
export async function getIntegration<T extends TIntegrationType>(params: {
  workspaceId: string;
  type: T;
  signal?: AbortSignal;
}): Promise<TIntegrationByType<T> | null> {
  const response = await fetch(`/api/workspaces/${params.workspaceId}/integrations/${params.type}`, {
    method: "GET",
    cache: "no-store",
    signal: params.signal,
  });
  if (!response.ok) {
    throw await parseV3ApiError(response);
  }
  const { data } = (await response.json()) as { data: TIntegrationByType<T> | null };
  return data ? reviveIntegrationDates(data) : null;
}
