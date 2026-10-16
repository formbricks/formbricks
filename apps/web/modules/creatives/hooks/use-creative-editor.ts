"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CREATIVES_LIST_QUERY_KEY,
  createCreative,
  creativeEditorKeys,
  getCreative,
  patchCreative,
} from "../lib/editor-api";
import type { TCreateCreativeBody, TCreativePatchBody, TCreativeResource } from "../lib/editor-form";

/**
 * The stored creative behind the editor. The page loads it on the server, so the query starts with that
 * resource and only changes through the editor's own writes; it never refetches over unsaved edits.
 */
export const useCreativeResource = (initialCreative: TCreativeResource) =>
  useQuery({
    queryKey: creativeEditorKeys.detail(initialCreative.id),
    queryFn: ({ signal }) => getCreative(initialCreative.id, signal),
    initialData: initialCreative,
    staleTime: Infinity,
  });

export const useCreateCreative = () => {
  const queryClient = useQueryClient();
  return useMutation<TCreativeResource, Error, TCreateCreativeBody>({
    mutationFn: createCreative,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: CREATIVES_LIST_QUERY_KEY });
    },
  });
};

export const useUpdateCreative = (creativeId: string) => {
  const queryClient = useQueryClient();
  return useMutation<TCreativeResource, Error, TCreativePatchBody>({
    mutationFn: (body) => patchCreative(creativeId, body),
    onSuccess: async (creative) => {
      queryClient.setQueryData(creativeEditorKeys.detail(creativeId), creative);
      await queryClient.invalidateQueries({ queryKey: CREATIVES_LIST_QUERY_KEY });
    },
  });
};
