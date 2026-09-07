"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { deleteTag } from "../lib/api-client";
import { tagKeys } from "../lib/query";

/** Delete a tag, then invalidate the list — replacing a `router.refresh()` full-page revalidation. */
export const useDeleteTag = (workspaceId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (variables: { tagId: string }) => deleteTag(variables),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: tagKeys.list(workspaceId) }),
  });
};
