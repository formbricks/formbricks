"use client";

import { useQuery } from "@tanstack/react-query";
import { getPublishedWorkflowVersion } from "../lib/api-client";
import { workflowKeys } from "../lib/query";

/**
 * The workflow's latest enabled version, for "Discard changes": null when it was never enabled, in
 * which case there is nothing to go back to. Enable it only for members who can edit the draft.
 */
export const usePublishedWorkflowVersion = ({
  workflowId,
  enabled,
}: {
  workflowId: string | null;
  enabled: boolean;
}) =>
  useQuery({
    queryKey: workflowKeys.publishedVersion(workflowId ?? ""),
    enabled: enabled && workflowId !== null,
    queryFn: ({ signal }) => getPublishedWorkflowVersion(workflowId as string, signal),
  });
