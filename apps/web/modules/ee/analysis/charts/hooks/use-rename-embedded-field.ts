"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { setEmbeddedFieldLabel } from "@/modules/ee/analysis/lib/api-client";
import { chartKeys, dashboardKeys } from "@/modules/ee/analysis/lib/query";
import { chartFieldCatalogQueryPrefix } from "./chart-field-catalog-query";

/**
 * Rename an imported (embedded-data) key across the workspace. Once saved, every read that shows the key's
 * name is refreshed: each of the workspace's dataset field catalogs (the builder's pickers), every chart's
 * data (legends and headers come with it as `memberLabels`), and the dashboards' filter fields.
 */
export const useRenameEmbeddedField = (workspaceId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      key,
      label,
      expectedLabel,
    }: {
      key: string;
      label: string;
      expectedLabel: string | null;
    }) => setEmbeddedFieldLabel({ workspaceId, key, label, expectedLabel }),
    // Refreshed on a refusal too: a 409 means another editor's name is stored, and the editor should see it.
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: chartFieldCatalogQueryPrefix(workspaceId) }),
        queryClient.invalidateQueries({ queryKey: chartKeys.allData() }),
        queryClient.invalidateQueries({ queryKey: dashboardKeys.details() }),
      ]),
  });
};
