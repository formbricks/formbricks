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
import { getUnsavedWorkspaceCssDraft, keepUnsavedWorkspaceCssDraft } from "../lib/unsaved-draft";
import { customCssKeys } from "../lib/validation";
import { useCustomCssValidation } from "./use-custom-css-validation";

/**
 * Everything the workspace Custom CSS card and the Appearance preview share: the saved resource
 * (`GET`), the creator's draft, its live validation and the save (`PATCH`). Lives in the page's
 * styling component because the preview there renders the draft's validated output.
 *
 * The draft is `null` until the creator changes something, so it follows the saved CSS when that
 * loads or is saved, and the preview starts from exactly what respondents get. A draft left unsaved
 * on an earlier visit in this session stands in until then (see `unsaved-draft.ts`).
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

  const saved = resourceQuery.data?.customCss ?? null;
  const keptDraft = resourceQuery.isSuccess ? getUnsavedWorkspaceCssDraft(workspaceId, saved) : null;
  const draft = editedDraft ?? keptDraft ?? toCustomCssDraft(saved);

  const setDraft = (next: TCustomCssDraft | null) => {
    setEditedDraft(next);
    keepUnsavedWorkspaceCssDraft(workspaceId, saved, next);
  };

  const saveMutation = useMutation({
    mutationFn: (customCss: TCustomCssInput | null) => updateWorkspaceCustomCss({ workspaceId, customCss }),
    onSuccess: ({ resource }) => {
      queryClient.setQueryData<TWorkspaceCustomCssResource>(customCssKeys.workspace(workspaceId), resource);
      setEditedDraft(null);
      keepUnsavedWorkspaceCssDraft(workspaceId, resource.customCss, null);
    },
  });

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
    /** The draft was left unsaved on an earlier visit, and not edited since. */
    isDraftRestored: editedDraft === null && keptDraft !== null,
    setDraft,
    resetDraft: () => setDraft(null),
    changeKind: getCustomCssChangeKind(saved, draft),
    validation,
    save: saveMutation.mutateAsync,
    isSaving: saveMutation.isPending,
  };
};
