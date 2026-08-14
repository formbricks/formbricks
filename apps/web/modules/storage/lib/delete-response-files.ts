import "server-only";
import { logger } from "@formbricks/logger";
import { findWorkspaceByIdOrLegacyEnvId } from "@/lib/utils/resolve-client-id";
import { deleteFile } from "@/modules/storage/service";
import { parseStorageFileUrl } from "@/modules/storage/utils";

/**
 * Deletes the storage objects a response's file-upload answers point at, restricted to the survey's own
 * workspace.
 *
 * The file URLs come out of `response.data`, i.e. from whoever wrote the response, and the S3 key is
 * built from the id in the *URL* rather than the survey's workspace. Write-time validation
 * (`validateClientFileUploads` -> `isScopedPrivateUploadUrl`) does pin uploaded URLs to the survey's
 * workspace, but it only inspects keys that match a file-upload element that exists *at write time*. A
 * caller can therefore plant a foreign URL under a key that is not yet an element, then edit the survey
 * to turn that key into a file-upload element — a time-of-check/time-of-use gap that makes the planted,
 * unvalidated URL look like a real answer at delete time.
 *
 * So the delete side cannot trust the URL's id. Re-resolve each URL's storage id here and drop anything
 * that does not belong to this survey's workspace, regardless of which write path produced the data. The
 * id may be a workspace id or a legacy environment id (older uploads were prefixed with the environment
 * id), which is why it goes through `findWorkspaceByIdOrLegacyEnvId` rather than a plain string compare.
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
