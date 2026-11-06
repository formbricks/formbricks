"use client";

import { useQuery } from "@tanstack/react-query";
import type { TIntegrationByType, TIntegrationType } from "@formbricks/types/integration";
import { getIntegration } from "../lib/api-client";
import { integrationKeys } from "../lib/query";

/**
 * One integration settings page's integration. Seeded from the server-rendered page so the first paint
 * needs no request; the add/edit/remove flows invalidate `integrationKeys.byType` to refetch the list.
 * `staleTime: Infinity` is safe because the provider lives in `template.tsx`, which remounts per navigation.
 */
export const useIntegration = <T extends TIntegrationType>(
  workspaceId: string,
  type: T,
  initialIntegration: TIntegrationByType<T> | undefined
) => {
  const { data } = useQuery({
    queryKey: integrationKeys.byType(workspaceId, type),
    queryFn: ({ signal }) => getIntegration({ workspaceId, type, signal }),
    initialData: initialIntegration ?? null,
    staleTime: Infinity,
  });
  return data ?? undefined;
};
