"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { mergeTags } from "../lib/api-client";
import { tagKeys } from "../lib/query";

/**
 * Merge one tag into another, then invalidate the list. A merge changes two rows — the source disappears
 * and the target's count grows — so it invalidates rather than patching the cache by hand.
 */
export const useMergeTags = (workspaceId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (variables: { tagId: string; newTagId: string }) => mergeTags(variables),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: tagKeys.list(workspaceId) }),
  });
};
