"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  TEmbeddedDataCreateBody,
  TEmbeddedDataPromoteBody,
  TEmbeddedDataUpdateBody,
} from "@/app/api/internal/embedded-data/schemas";
import {
  createEmbeddedData,
  deleteEmbeddedData,
  promoteEmbeddedData,
  updateEmbeddedData,
} from "../lib/api-client";
import { embeddedDataKeys, embeddedDataListQueryOptions, embeddedDataUsageQueryOptions } from "../lib/query";

export const useEmbeddedDataLibrary = (workspaceId: string) =>
  useQuery(embeddedDataListQueryOptions(workspaceId));

export const useEmbeddedDataUsage = (id: string, { enabled }: { enabled: boolean }) =>
  useQuery({ ...embeddedDataUsageQueryOptions(id), enabled });

/**
 * A library write. Every outcome refetches the library: a refusal says the list the author was looking at
 * is out of date (a key someone took, a survey that linked the field meanwhile), so it is the moment to
 * catch up too. Usage is per field and only ever read in a popover, so it is dropped rather than refetched.
 */
const useLibraryWrite = <TVariables, TResult>(
  workspaceId: string,
  write: (variables: TVariables) => Promise<TResult>
) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: write,
    onSettled: async () => {
      queryClient.removeQueries({ queryKey: embeddedDataKeys.usages() });
      await queryClient.invalidateQueries({ queryKey: embeddedDataKeys.list(workspaceId) });
    },
  });
};

export const useCreateEmbeddedData = (workspaceId: string) =>
  useLibraryWrite(workspaceId, (body: TEmbeddedDataCreateBody) => createEmbeddedData(workspaceId, body));

export const useUpdateEmbeddedData = (workspaceId: string) =>
  useLibraryWrite(workspaceId, ({ id, body }: { id: string; body: TEmbeddedDataUpdateBody }) =>
    updateEmbeddedData(id, body)
  );

export const useDeleteEmbeddedData = (workspaceId: string) =>
  useLibraryWrite(workspaceId, (id: string) => deleteEmbeddedData(id));

export const usePromoteEmbeddedData = (workspaceId: string) =>
  useLibraryWrite(workspaceId, ({ id, body }: { id: string; body: TEmbeddedDataPromoteBody }) =>
    promoteEmbeddedData(id, body)
  );
