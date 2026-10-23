"use client";

import { useQuery } from "@tanstack/react-query";
import { type TCustomCssCompiled, type TCustomCssInput } from "@formbricks/types/custom-css";
import { getWorkspaceCustomCss } from "../lib/api-client";
import { isSameCustomCss, toCustomCssDraft } from "../lib/draft";
import { customCssKeys } from "../lib/validation";
import { useCustomCssValidation } from "./use-custom-css-validation";

interface TWorkspaceCss {
  source: TCustomCssInput | null;
  compiled: TCustomCssCompiled | null;
}

/**
 * The workspace CSS the survey editor inherits, kept current. The page loads it once; a creator who
 * saves new workspace CSS in another tab would otherwise preview against the old rules until a reload.
 * The saved source is re-read when the window regains focus and, if it changed, compiled by the same
 * validate route the editors use, so the preview still only shows server-processed CSS.
 */
export const useLiveWorkspaceCustomCss = (params: {
  workspaceId: string;
  enabled: boolean;
  initial: TWorkspaceCss;
}): TWorkspaceCss => {
  const { workspaceId, enabled, initial } = params;
  const resourceQuery = useQuery({
    queryKey: customCssKeys.workspace(workspaceId),
    queryFn: ({ signal }) => getWorkspaceCustomCss({ workspaceId, signal }),
    enabled,
    refetchOnWindowFocus: "always",
  });

  const liveSource = resourceQuery.data ? resourceQuery.data.customCss : undefined;
  const hasChanged = liveSource !== undefined && !isSameCustomCss(liveSource, initial.source);
  const validation = useCustomCssValidation({
    workspaceId,
    scope: "workspace",
    draft: toCustomCssDraft(liveSource ?? null),
    enabled: enabled && hasChanged,
  });

  if (!hasChanged) return initial;
  // Until the new source is compiled (or if it no longer passes) the preview keeps what the page loaded.
  const compiled =
    validation.status === "valid" && !validation.isPreviewBehind ? validation.previewCss : null;
  return { source: liveSource ?? null, compiled: compiled ?? (liveSource ? initial.compiled : null) };
};
