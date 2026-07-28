import "server-only";
import { logger } from "@formbricks/logger";
import { findWorkspaceByIdOrLegacyEnvId } from "@/lib/utils/resolve-client-id";
import { deleteFile } from "@/modules/storage/service";
import { parseStorageFileUrl } from "@/modules/storage/utils";

/**
 * Deletes the storage objects a response's file-upload answers point at, restricted to the survey's own
 * workspace.
 *
 * These URLs come out of `response.data`, i.e. from whoever wrote the response, and the storage key is
 * built from the *URL's* id rather than the survey's. The public client endpoints pin the URL to the
 * survey's workspace (`validateClientFileUploads` → `isScopedPrivateUploadUrl`), but the management API
 * validates only the file extension (`validateFileUploads`) — so an API key scoped to one workspace can
 * store a URL pointing into another tenant's storage prefix and then delete the response to have this
 * code remove that tenant's object.
 *
 * Re-resolving each URL's storage id here and dropping anything that does not belong to this survey's
 * workspace keeps the sink safe regardless of which write path produced the data. The id may be either a
 * workspace id or a legacy environment id, which is why it goes through
 * `findWorkspaceByIdOrLegacyEnvId` rather than a string comparison.
 */
export const deleteResponseFileUrls = async (
  fileUrls: string[],
  surveyWorkspaceId: string | undefined
): Promise<void> => {
  if (!surveyWorkspaceId) {
    // Without the owning workspace there is nothing to authorize against, so delete nothing.
    logger.error({ fileCount: fileUrls.length }, "Skipping response file deletion: no workspace id given");
    return;
  }

  await Promise.all(
    fileUrls.map(async (fileUrl) => {
      try {
        const storageFile = parseStorageFileUrl(fileUrl);

        if (!storageFile) {
          throw new Error(`Invalid storage file URL: ${fileUrl}`);
        }

        const storageWorkspace = await findWorkspaceByIdOrLegacyEnvId(storageFile.storageId);
        if (storageWorkspace?.id !== surveyWorkspaceId) {
          logger.error(
            { fileUrl, surveyWorkspaceId, storageId: storageFile.storageId },
            "Refusing to delete a response file stored outside the survey's workspace"
          );
          return;
        }

        await deleteFile(
          storageFile.storageId,
          storageFile.accessType,
          storageFile.fileName,
          surveyWorkspaceId
        );
      } catch (error) {
        logger.error({ error, fileUrl }, "Failed to delete file");
      }
    })
  );
};
