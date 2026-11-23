"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { retryUnlessClientError, v3RetryDelay } from "@/modules/api/lib/v3-client";
import { createContactDirectory, fetchContactDirectories, updateContactDirectory } from "../lib/api-client";
import { contactDirectoryKeys } from "../lib/query";
import type { TContactDirectoryCreateInput, TContactDirectoryUpdateInput } from "../types";

/** The organization's directories and workspaces: the list and the workspace picker read the same document. */
export const useContactDirectories = ({ organizationId }: Readonly<{ organizationId: string }>) =>
  useQuery({
    queryKey: contactDirectoryKeys.list(organizationId),
    queryFn: ({ signal }) => fetchContactDirectories({ organizationId, signal }),
    retry: retryUnlessClientError(3),
    retryDelay: v3RetryDelay,
  });

/**
 * A save can move workspaces between directories and delete the ones they left, so the whole list is
 * refetched afterwards, failed saves included (the server state may have moved since it was read).
 */
const useInvalidateList = (organizationId: string) => {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: contactDirectoryKeys.list(organizationId) });
};

export const useCreateContactDirectory = ({ organizationId }: Readonly<{ organizationId: string }>) => {
  const invalidateList = useInvalidateList(organizationId);
  return useMutation({
    mutationFn: (input: TContactDirectoryCreateInput) => createContactDirectory({ organizationId, input }),
    onSettled: invalidateList,
  });
};

export const useUpdateContactDirectory = ({ organizationId }: Readonly<{ organizationId: string }>) => {
  const invalidateList = useInvalidateList(organizationId);
  return useMutation({
    mutationFn: ({ directoryId, input }: { directoryId: string; input: TContactDirectoryUpdateInput }) =>
      updateContactDirectory({ directoryId, input }),
    onSettled: invalidateList,
  });
};
