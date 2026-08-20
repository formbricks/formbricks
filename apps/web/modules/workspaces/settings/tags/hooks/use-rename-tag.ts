"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { renameTag } from "../lib/api-client";
import { tagKeys } from "../lib/query";

/**
 * Rename a tag, then invalidate the list.
 *
 * `useMutation` is what serializes renames: the input is disabled while `isPending`, so a second blur
 * cannot start a request that races the first. Two concurrent renames could otherwise land out of order
 * and leave the earlier name in storage.
 */
export const useRenameTag = (workspaceId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (variables: { tagId: string; name: string }) => renameTag(variables),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: tagKeys.list(workspaceId) }),
  });
};
