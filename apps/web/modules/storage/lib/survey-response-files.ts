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
 * Collects the storage URLs a survey's responses own, so they can be deleted once the responses
 * themselves are gone.
 *
 * Must run *before* the responses are deleted: the URLs only exist inside `response.data`, so once the
 * rows are gone there is nothing left to tell storage which objects are now unreferenced.
 *
 * Which URLs a response owns is `collectResponseFileUrls`' rule, shared with the single-response delete
 * paths: a survey-scoped key is bound to the survey it names, whatever answer it sits under, and a flat
 * pre-#8044 key only counts under a current file-upload element.
 *
 * `flatKeysOnly` is for survey delete, whose folder sweep (`deleteSurveyUploadFilesBestEffort`) already
 * removes every key filed under the survey. It returns only the flat keys the sweep cannot reach, and
 * since those can only match a current upload element, it skips the scan when there is none rather than
 * reading every response for nothing.
 */
export const collectSurveyResponseFileUrls = async (
  surveyId: string,
  { flatKeysOnly = false }: { flatKeysOnly?: boolean } = {}
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

  // Only the flat-key scan may skip on an empty set: a flat key is matched by element id, so with no
  // current upload element it has nothing to match. The full scan (reset) runs anyway, because a survey
  // whose only upload element was deleted still has answers holding keys filed under it. Those are bound
  // to this survey by the key itself, not by the answer's shape, so the scan never reaches another
  // survey's files. Reset cannot use a folder sweep instead: a respondent still filling in the survey has
  // uploads whose response row does not exist yet, and a sweep would delete them.
  if (flatKeysOnly && fileUploadElementIds.size === 0) {
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
      for (const fileUrl of collectResponseFileUrls(response.data, fileUploadElementIds, surveyId)) {
        if (!flatKeysOnly || getStorageUrlSurveyId(fileUrl) === null) fileUrls.push(fileUrl);
      }
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
 * Survey binding is not re-checked here: the collection already refuses a key filed under another
 * survey, and `deleteResponseFileUrls` still enforces the workspace.
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
  for (let i = 0; i < fileUrls.length; i += STORAGE_DELETE_CHUNK_SIZE) {
    const chunk = fileUrls.slice(i, i + STORAGE_DELETE_CHUNK_SIZE);
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
