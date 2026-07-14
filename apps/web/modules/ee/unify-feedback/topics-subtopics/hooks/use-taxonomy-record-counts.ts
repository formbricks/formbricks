"use client";

import { useQuery } from "@tanstack/react-query";
import { InvalidInputError } from "@formbricks/types/errors";
import { getTaxonomyRecordCounts } from "../lib/api-client";
import { taxonomyKeys } from "../lib/query";

/**
 * Per-node distinct feedback-record counts (subtree totals) for the active run. Keyed on runId, so a
 * fresh run automatically loads new counts; a rename/remove that changes totals is picked up by
 * invalidating this key. Disabled until there is an active run.
 */
export const useTaxonomyRecordCounts = ({
  workspaceId,
  directoryId,
  runId,
  enabled = true,
}: Readonly<{ workspaceId: string; directoryId: string; runId: string | null; enabled?: boolean }>) =>
  useQuery({
    queryKey: taxonomyKeys.recordCounts(workspaceId, directoryId, runId ?? ""),
    enabled: enabled && runId !== null,
    queryFn: ({ signal }) => {
      if (!runId) {
        throw new InvalidInputError("runId is required");
      }
      return getTaxonomyRecordCounts({ workspaceId, directoryId, runId, signal });
    },
    staleTime: 60_000,
  });
