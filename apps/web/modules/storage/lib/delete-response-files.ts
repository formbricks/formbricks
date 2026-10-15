import "server-only";
import { logger } from "@formbricks/logger";
import { StorageErrorCode } from "@formbricks/storage";
import { findWorkspaceByIdOrLegacyEnvId } from "@/lib/utils/resolve-client-id";
import { deleteFile } from "@/modules/storage/service";
import { parseStorageFileUrl } from "@/modules/storage/utils";

/**
 * Deletes the storage objects a response's answers point at, as picked by `collectResponseFileUrls`,
 * restricted to the survey's own workspace.
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
 * Binding to the survey is enforced earlier, when `collectResponseFileUrls` picks the URLs.
 */
export const deleteResponseFileUrls = async (
  fileUrls: string[],
  surveyWorkspaceId: string | undefined
): Promise<{ failed: string[] }> => {
  if (!surveyWorkspaceId) {
    // Without the owning workspace there is nothing to authorize against, so delete nothing.
    logger.error({ fileCount: fileUrls.length }, "Skipping response file deletion: no workspace id given");
    return { failed: [] };
  }
  // Files whose delete failed in a way worth retrying: a storage or lookup error. A URL refused as
  // malformed or foreign, or a key storage refuses, is final and isn't listed: retrying can't change it.
  const failed: string[] = [];

  // Several files in one response usually share a storage id (same survey/workspace prefix). Cache the
  // resolution promise per id so the batch does one lookup per distinct id instead of one per file.
  const workspaceByStorageId = new Map<string, ReturnType<typeof findWorkspaceByIdOrLegacyEnvId>>();
  const resolveStorageWorkspace = (storageId: string) => {
    const cached = workspaceByStorageId.get(storageId);
    if (cached) return cached;

    const pending = findWorkspaceByIdOrLegacyEnvId(storageId);
    workspaceByStorageId.set(storageId, pending);
    return pending;
  };

  // No log here carries a URL: it holds the file name the respondent chose, which can be personal data
  // (ENG-3721), and a failure the cleanup drain retries would be logged again on every retry.
  await Promise.all(
    fileUrls.map(async (fileUrl) => {
      const storageFile = parseStorageFileUrl(fileUrl);
      if (!storageFile) {
        logger.error({ surveyWorkspaceId }, "Skipping response file deletion: not a storage file URL");
        return;
      }

      // The URL carries the percent-encoded file name, but the object is stored under the decoded
      // name (upload encodes it into the URL; the download path decodes before hitting S3). Decode
      // here too, or files with spaces/non-ASCII names miss their key and never get deleted. Decoding
      // before deleteFile also lets its hasTraversalSegment check run on the decoded segments.
      let fileName: string;
      try {
        fileName = decodeURIComponent(storageFile.fileName);
      } catch {
        logger.error(
          { storageId: storageFile.storageId, accessType: storageFile.accessType },
          "Skipping response file deletion: malformed file name"
        );
        return;
      }

      try {
        const storageWorkspace = await resolveStorageWorkspace(storageFile.storageId);
        if (storageWorkspace?.id !== surveyWorkspaceId) {
          logger.error(
            { surveyWorkspaceId, storageId: storageFile.storageId, accessType: storageFile.accessType },
            "Refusing to delete a response file stored outside the survey's workspace"
          );
          return;
        }

        // deleteFile returns an error result (it does not throw) on S3 failures, so a discarded result
        // would treat a failed deletion as a success and leave the object behind unlogged.
        const result = await deleteFile(
          storageFile.storageId,
          storageFile.accessType,
          fileName,
          surveyWorkspaceId
        );
        if (!result.ok) {
          // Already gone is done; a key storage refuses (traversal, empty segment) is final.
          if (result.error.code === StorageErrorCode.FileNotFoundError) return;
          if (result.error.code !== StorageErrorCode.InvalidInput) failed.push(fileUrl);
          logger.error(
            {
              storageId: storageFile.storageId,
              accessType: storageFile.accessType,
              surveyWorkspaceId,
              error: result.error,
            },
            "Failed to delete a response file from storage"
          );
        }
      } catch (error) {
        failed.push(fileUrl);
        logger.error(
          { err: error, storageId: storageFile.storageId, accessType: storageFile.accessType },
          "Failed to delete file"
        );
      }
    })
  );
  return { failed };
};
