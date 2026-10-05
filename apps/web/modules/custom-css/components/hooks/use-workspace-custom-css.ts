"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { type TCustomCssInput } from "@formbricks/types/custom-css";
import {
  type TWorkspaceCustomCssResource,
  getWorkspaceCustomCss,
  updateWorkspaceCustomCss,
} from "../lib/api-client";
import { type TCustomCssDraft, getCustomCssChangeKind, toCustomCssDraft } from "../lib/draft";
import { customCssKeys } from "../lib/validation";
import { useCustomCssValidation } from "./use-custom-css-validation";

/**
 * Everything the workspace Custom CSS card and the Look & Feel preview share: the saved resource
 * (`GET`), the creator's draft, its live validation and the save (`PATCH`). Lives in the page's
 * styling component because the preview there renders the draft's validated output.
 *
 * The draft is `null` until the creator changes something, so it follows the saved CSS when that
 * loads or is saved, and the preview starts from exactly what respondents get.
 */
export const useWorkspaceCustomCssEditor = (params: { workspaceId: string; enabled: boolean }) => {
  const { workspaceId, enabled } = params;
  const queryClient = useQueryClient();
  const [editedDraft, setEditedDraft] = useState<TCustomCssDraft | null>(null);

  const resourceQuery = useQuery({
    queryKey: customCssKeys.workspace(workspaceId),
    queryFn: ({ signal }) => getWorkspaceCustomCss({ workspaceId, signal }),
    enabled,
    refetchOnWindowFocus: false,
  });

  const saveMutation = useMutation({
    mutationFn: (customCss: TCustomCssInput | null) => updateWorkspaceCustomCss({ workspaceId, customCss }),
    onSuccess: ({ resource }) => {
      queryClient.setQueryData<TWorkspaceCustomCssResource>(customCssKeys.workspace(workspaceId), resource);
      setEditedDraft(null);
    },
  });

  const saved = resourceQuery.data?.customCss ?? null;
  const draft = editedDraft ?? toCustomCssDraft(saved);

  const validation = useCustomCssValidation({
    workspaceId,
    scope: "workspace",
    draft,
    enabled: enabled && resourceQuery.isSuccess,
  });

  return {
    resource: resourceQuery.data,
    isLoading: resourceQuery.isPending && enabled,
    loadError: resourceQuery.error,
    draft,
    setDraft: setEditedDraft,
    resetDraft: () => setEditedDraft(null),
    changeKind: getCustomCssChangeKind(saved, draft),
    validation,
    save: saveMutation.mutateAsync,
    isSaving: saveMutation.isPending,
  };
};
