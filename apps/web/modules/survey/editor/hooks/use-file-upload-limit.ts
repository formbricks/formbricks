"use client";

import { useQuery } from "@tanstack/react-query";
import type { TFileUploadLimitResource } from "@/app/api/internal/workspaces/[workspaceId]/file-upload-limit/lib/operations";
import { getApiData } from "@/modules/api/lib/internal-api-client";
import { QUERY_RETRY, QUERY_STALE_TIME_MS } from "@/modules/api/lib/query-client";

export const fileUploadLimitKeys = {
  all: ["file-upload-limit"] as const,
  detail: (workspaceId: string) => [...fileUploadLimitKeys.all, workspaceId] as const,
};

/**
 * The file size cap the editor offers a file upload question, from the workspace's plan. Every file
 * upload question shares the one cached request. Carries the house retry rule itself: the survey editor
 * renders it under a query client without those defaults.
 */
export const useFileUploadLimit = (workspaceId: string) =>
  useQuery({
    queryKey: fileUploadLimitKeys.detail(workspaceId),
    queryFn: ({ signal }) =>
      getApiData<TFileUploadLimitResource>(
        `/api/internal/workspaces/${encodeURIComponent(workspaceId)}/file-upload-limit`,
        { signal }
      ),
    staleTime: QUERY_STALE_TIME_MS,
    ...QUERY_RETRY,
  });
