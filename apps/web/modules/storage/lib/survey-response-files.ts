import "server-only";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import { getSurvey } from "@/lib/survey/service";
import { deleteResponseFileUrls } from "@/modules/storage/lib/delete-response-files";
import {
  collectResponseFileUrls,
  getStorageUrlSurveyId,
  getSurveyFileUploadElementIds,
} from "@/modules/storage/utils";

/**
 * Responses are scanned in pages so a survey with a large response count never holds every
 * `response.data` blob at once. Note this bounds only the blobs: the collected URLs still accumulate
 * across pages, which is what STORAGE_DELETE_CHUNK_SIZE bounds on the way out.
 */
const RESPONSE_FILE_SCAN_PAGE_SIZE = 500;

/**
 * Storage deletes are issued in bounded chunks. `deleteResponseFileUrls` fans out with `Promise.all`
 * over every URL it is handed, so passing a whole survey's worth at once would open one storage
 * request per uploaded file. Chunking caps the in-flight requests no matter how many files the scan
 * collected.
 */
const STORAGE_DELETE_CHUNK_SIZE = 100;

/** Keyset position in the scan: the last row read, ordered by (createdAt, id). */
type ResponseScanCursor = { createdAt: Date; id: string };

/**
 * Keyset predicate for "strictly after this row" in (createdAt, id) order.
 *
 * The scan orders by createdAt rather than id alone so it can ride the existing
 * `@@index([surveyId, createdAt])` on Response. Ordering by `id` would have no supporting index —
 * `(surveyId, id)` does not exist — leaving the planner to either sort the survey's whole response set
 * on every page or scan by primary key across the entire table. `id` is only the tiebreaker that makes
 * the order total, so responses sharing a createdAt are neither skipped nor read twice.
 */
const afterCursor = (cursor: ResponseScanCursor) => ({
  OR: [{ createdAt: { gt: cursor.createdAt } }, { createdAt: cursor.createdAt, id: { gt: cursor.id } }],
});

/**
 * Collects the storage URLs a survey's file-upload answers point at, so they can be deleted once the
 * responses themselves are gone.
 *
 * Must run *before* the responses are deleted: the URLs only exist inside `response.data`, so once the
 * rows are gone there is nothing left to tell storage which objects are now unreferenced.
 *
 * The extraction itself is shared with the single-response delete paths
 * (`getSurveyFileUploadElementIds` + `collectResponseFileUrls` in modules/storage/utils), so all of them
 * read the same id set and skip the same malformed answers.
 */
export const collectSurveyResponseFileUrls = async (
  surveyId: string
): Promise<{ fileUrls: string[]; workspaceId: string | undefined }> => {
  // getSurvey is reactCache'd, so a caller that fetched the same survey earlier in the request (the
  // reset action does) resolves it from the request cache rather than a second round-trip — and it
  // hands back typed blocks/questions instead of raw JSON columns needing a cast. This is also the
  // source the single-response cleanup path reads the survey from.
  const survey = await getSurvey(surveyId);

  if (!survey) {
    return { fileUrls: [], workspaceId: undefined };
  }

  const fileUploadElementIds = getSurveyFileUploadElementIds(survey);

  // No file-upload element in the survey's *current* definition, so there is no key this scan would
  // match — skip it. Note this is about today's blocks/questions, not the response history: answers
  // left by an upload element that was since deleted sit under an id no longer in the set, and are not
  // cleaned up here or by the single-response path. Widening the match to "any answer shaped like a
  // storage URL" is deliberately not the fix — it would let one survey's cleanup delete another's
  // live files.
  if (fileUploadElementIds.size === 0) {
    return { fileUrls: [], workspaceId: survey.workspaceId };
  }

  const fileUrls: string[] = [];
  let cursor: ResponseScanCursor | undefined;

  for (;;) {
    const responses = await prisma.response.findMany({
      where: { surveyId, ...(cursor ? afterCursor(cursor) : {}) },
      select: { id: true, createdAt: true, data: true },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take: RESPONSE_FILE_SCAN_PAGE_SIZE,
    });

    if (responses.length === 0) {
      break;
    }

    for (const response of responses) {
      fileUrls.push(...collectResponseFileUrls(response.data, fileUploadElementIds));
    }

    // A short page means the last one. The `lastRow` check only guards the cursor from going undefined
    // and re-reading the same page forever; a full page always has a last row.
    const lastRow = responses.at(-1);
    if (responses.length < RESPONSE_FILE_SCAN_PAGE_SIZE || !lastRow) {
      break;
    }

    cursor = { createdAt: lastRow.createdAt, id: lastRow.id };
  }

  return { fileUrls, workspaceId: survey.workspaceId };
};

/**
 * Deletes the files `collectSurveyResponseFileUrls` found, in chunks of STORAGE_DELETE_CHUNK_SIZE.
 *
 * A URL whose key is filed under a different survey is dropped first. `deleteResponseFileUrls` only
 * checks the workspace, and an answer can hold another survey's URL: one written under a key that
 * only later became a file-upload element is never checked against its survey.
 *
 * Callers run this after the responses are committed as deleted, so it never throws: turning a
 * completed delete into a failed one would only make the caller retry against rows that are gone.
 * `deleteResponseFileUrls` already logs and swallows per-file errors, and the guard here covers an
 * unexpected throw. The cost of a failure is objects left in storage, not a delete to retry.
 */
export const deleteSurveyResponseFiles = async (
  fileUrls: string[],
  workspaceId: string | undefined,
  surveyId: string
): Promise<void> => {
  const ownFileUrls = fileUrls.filter((fileUrl) => {
    const keySurveyId = getStorageUrlSurveyId(fileUrl);
    return keySurveyId === null || keySurveyId === surveyId;
  });

  if (ownFileUrls.length < fileUrls.length) {
    logger.error(
      { surveyId, workspaceId, fileCount: fileUrls.length - ownFileUrls.length },
      "Refusing to delete response files stored under another survey"
    );
  }

  for (let i = 0; i < ownFileUrls.length; i += STORAGE_DELETE_CHUNK_SIZE) {
    const chunk = ownFileUrls.slice(i, i + STORAGE_DELETE_CHUNK_SIZE);
    try {
      await deleteResponseFileUrls(chunk, workspaceId);
    } catch (error) {
      logger.error(
        { error, surveyId, workspaceId, fileCount: chunk.length },
        "Failed to delete a survey's response files from storage"
      );
    }
  }
};
