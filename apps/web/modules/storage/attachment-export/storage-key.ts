/** Pure helpers, kept apart from `service.ts` so the `/storage` route can import them without the job queue. */

/**
 * Where an export's archive lives. Under the survey's upload prefix on purpose: deleting the survey
 * deletes `{workspaceId}/private/surveys/{surveyId}/`, so the archive goes with it and needs no cleanup of
 * its own. The `/storage` route refuses this path (`isAttachmentExportFilePath`), so the audited download
 * route is the only way to fetch it.
 */
export const buildAttachmentExportStorageKey = ({
  workspaceId,
  surveyId,
  attachmentExportId,
}: {
  workspaceId: string;
  surveyId: string;
  attachmentExportId: string;
}): string => `${workspaceId}/private/surveys/${surveyId}/exports/${attachmentExportId}.zip`;

/** The `[...filePath]` of a `/storage/{id}/private/...` request that names an export archive. */
const EXPORT_FILE_PATH_PATTERN = /^surveys\/[^/]+\/exports\//;

export const isAttachmentExportFilePath = (filePath: string): boolean =>
  EXPORT_FILE_PATH_PATTERN.test(filePath);
