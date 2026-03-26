import { z } from "zod";
import { ZId } from "@formbricks/types/common";

export const ZFeedbackRecordDirectory = z.object({
  id: ZId,
  name: z.string(),
  isArchived: z.boolean(),
  projectCount: z.number(),
});

export type TFeedbackRecordDirectory = z.infer<typeof ZFeedbackRecordDirectory>;

export const ZFeedbackRecordDirectoryDetails = z.object({
  id: ZId,
  name: z.string(),
  isArchived: z.boolean(),
  organizationId: ZId,
  projects: z.array(
    z.object({
      projectId: ZId,
      projectName: z.string(),
    })
  ),
});

export type TFeedbackRecordDirectoryDetails = z.infer<typeof ZFeedbackRecordDirectoryDetails>;

export const ZFeedbackRecordDirectoryCreateInput = z.object({
  name: z.string().trim().min(1, "DIRECTORY_NAME_REQUIRED"),
});

export type TFeedbackRecordDirectoryCreateInput = z.infer<typeof ZFeedbackRecordDirectoryCreateInput>;

export const ZFeedbackRecordDirectoryUpdateInput = z.object({
  name: z.string().trim().min(1, "DIRECTORY_NAME_REQUIRED").optional(),
  projectIds: z.array(ZId).optional(),
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
      return t("environments.settings.feedback_record_directories.error_directory_name_required");
    case "DIRECTORY_NAME_DUPLICATE":
      return t("environments.settings.feedback_record_directories.error_directory_name_duplicate");
    case "DIRECTORY_PROJECTS_INVALID_ORG":
      return t("environments.settings.feedback_record_directories.error_directory_projects_invalid_org");
    default:
      return errorCode;
  }
};
