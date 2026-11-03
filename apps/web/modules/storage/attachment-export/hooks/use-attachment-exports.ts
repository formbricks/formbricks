"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { TResponseFilterCriteria } from "@formbricks/types/responses";
import { retryUnlessClientError } from "@/modules/api/lib/v3-client";
import { createAttachmentExport, listAttachmentExports } from "../lib/api-client";
import { attachmentExportKeys, getAttachmentExportsRefetchInterval } from "../lib/query";
import type { TAttachmentExport } from "../types";

/**
 * The caller's recent attachment exports of a survey, polled while any of them is still building. One
 * list query serves both the download menu and the "ready" notification, so a build that finishes is
 * seen once, whichever surface is open.
 */
export const useAttachmentExports = ({
  surveyId,
  enabled = true,
}: Readonly<{ surveyId: string; enabled?: boolean }>) =>
  useQuery({
    queryKey: attachmentExportKeys.list(surveyId),
    queryFn: ({ signal }) => listAttachmentExports({ surveyId, signal }),
    enabled,
    staleTime: 0,
    retry: retryUnlessClientError(2),
    refetchInterval: (query) => getAttachmentExportsRefetchInterval(query.state.data),
  });

/**
 * Starts an export, then refetches the list so polling picks it up. The new export is written into the
 * cached list first: a build that finishes before the refetch lands would otherwise never be seen as
 * active, and its "ready" notification would never fire.
 */
export const useCreateAttachmentExport = ({ surveyId }: Readonly<{ surveyId: string }>) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (variables: { filterCriteria?: TResponseFilterCriteria }) =>
      createAttachmentExport({ surveyId, filterCriteria: variables.filterCriteria }),
    onSuccess: ({ attachmentExport }) => {
      queryClient.setQueryData<TAttachmentExport[]>(attachmentExportKeys.list(surveyId), (current) => [
        attachmentExport,
        ...(current ?? []).filter((item) => item.id !== attachmentExport.id),
      ]);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: attachmentExportKeys.list(surveyId) }),
  });
};
