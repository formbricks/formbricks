import { z } from "zod";
import { ZId } from "@formbricks/types/common";

export const ZFeedbackRecordDirectory = z.object({
  id: ZId,
  name: z.string(),
  isArchived: z.boolean(),
  workspaceCount: z.number(),
  connectorCount: z.number(),
});

export type TFeedbackRecordDirectory = z.infer<typeof ZFeedbackRecordDirectory>;

export const ZFeedbackRecordDirectoryDetails = z.object({
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
  connectors: z.array(
    z.object({
      id: ZId,
      name: z.string(),
      type: z.string(),
      workspaceId: ZId,
      workspaceName: z.string(),
    })
  ),
});

export type TFeedbackRecordDirectoryDetails = z.infer<typeof ZFeedbackRecordDirectoryDetails>;

export const ZFeedbackRecordDirectoryCreateInput = z.object({
  name: z.string().trim().min(1, "DIRECTORY_NAME_REQUIRED"),
  workspaceIds: z.array(ZId).optional(),
});

export type TFeedbackRecordDirectoryCreateInput = z.infer<typeof ZFeedbackRecordDirectoryCreateInput>;

export const ZFeedbackRecordDirectoryUpdateInput = z.object({
  name: z.string().trim().min(1, "DIRECTORY_NAME_REQUIRED").optional(),
  workspaceIds: z.array(ZId).optional(),
  isArchived: z.boolean().optional(),
});

export type TFeedbackRecordDirectoryUpdateInput = z.infer<typeof ZFeedbackRecordDirectoryUpdateInput>;

/**
 * Translates a feedback record directory error code using the provided `t` function.
 * Returns the translated message, or the raw error code if no mapping exists.
 */
export const getTranslatedFeedbackRecordDirectoryError = (
  errorCode: string,
  t: (key: string) => string
): string => {
  switch (errorCode) {
    case "DIRECTORY_NAME_REQUIRED":
      return t("workspace.settings.feedback_record_directories.error_directory_name_required");
    case "DIRECTORY_NAME_DUPLICATE":
      return t("workspace.settings.feedback_record_directories.error_directory_name_duplicate");
    case "DIRECTORY_PROJECTS_INVALID_ORG":
      return t("workspace.settings.feedback_record_directories.error_directory_workspaces_invalid_org");
    case "DIRECTORY_HAS_CONNECTORS":
      return t("workspace.settings.feedback_record_directories.error_directory_has_connectors");
    default:
      return errorCode;
  }
};
