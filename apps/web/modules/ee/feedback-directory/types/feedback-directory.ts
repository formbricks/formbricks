import { z } from "zod";
import { ZId } from "@formbricks/types/common";

export const ZFeedbackDirectory = z.object({
  id: ZId,
  name: z.string(),
  isArchived: z.boolean(),
  workspaceCount: z.number(),
  feedbackSourceCount: z.number(),
});

export type TFeedbackDirectory = z.infer<typeof ZFeedbackDirectory>;

export const ZFeedbackDirectoryDetails = z.object({
  id: ZId,
  name: z.string(),
  isArchived: z.boolean(),
  organizationId: ZId,
  workspaces: z.array(
    z.object({
      workspaceId: ZId,
      workspaceName: z.string(),
    })
  ),
  feedbackSources: z.array(
    z.object({
      id: ZId,
      name: z.string(),
      type: z.string(),
      workspaceId: ZId,
      workspaceName: z.string(),
    })
  ),
});

export type TFeedbackDirectoryDetails = z.infer<typeof ZFeedbackDirectoryDetails>;

export interface TWorkspaceFeedbackDirectoryAccess {
  workspaceId: string;
  feedbackDirectoryId: string;
  feedbackDirectoryName: string;
}

export const ZFeedbackDirectoryCreateInput = z.object({
  name: z.string().trim().min(1, "DIRECTORY_NAME_REQUIRED"),
  workspaceIds: z.array(ZId).optional(),
});

export type TFeedbackDirectoryCreateInput = z.infer<typeof ZFeedbackDirectoryCreateInput>;

export const ZFeedbackDirectoryUpdateInput = z.object({
  name: z.string().trim().min(1, "DIRECTORY_NAME_REQUIRED").optional(),
  workspaceIds: z.array(ZId).optional(),
  isArchived: z.boolean().optional(),
});

export type TFeedbackDirectoryUpdateInput = z.infer<typeof ZFeedbackDirectoryUpdateInput>;

/**
 * Translates a feedback directory error code using the provided `t` function.
 * Returns the translated message, or the raw error code if no mapping exists.
 */
export const getTranslatedFeedbackDirectoryError = (
  errorCode: string,
  t: (key: string) => string
): string => {
  switch (errorCode) {
    case "DIRECTORY_NAME_REQUIRED":
      return t("workspace.settings.feedback_directories.error_directory_name_required");
    case "DIRECTORY_NAME_DUPLICATE":
      return t("workspace.settings.feedback_directories.error_directory_name_duplicate");
    case "DIRECTORY_WORKSPACES_INVALID_ORG":
      return t("workspace.settings.feedback_directories.error_directory_workspaces_invalid_org");
    case "DIRECTORY_HAS_FEEDBACK_SOURCES":
      return t("workspace.settings.feedback_directories.error_directory_has_feedback_sources");
    case "WORKSPACE_ALREADY_ASSIGNED_TO_DIFFERENT_DIRECTORY":
      return t("workspace.settings.feedback_directories.error_workspace_already_assigned");
    default:
      return errorCode;
  }
};
