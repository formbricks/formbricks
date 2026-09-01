import "server-only";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { logger } from "@formbricks/logger";
import { DatabaseError } from "@formbricks/types/errors";
import { convertFloatTo2Decimal } from "@/app/(app)/workspaces/[workspaceId]/surveys/[surveyId]/(analysis)/summary/lib/utils";
import { getSurvey } from "@/lib/survey/service";
import { deleteResponseFileUrls } from "@/modules/storage/lib/delete-response-files";
import { getSurveyFileUploadConfigs } from "@/modules/storage/utils";

/**
 * Responses are scanned in pages so resetting a survey with a large response count never holds every
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

/** One response row as the scan below selects it. */
type ScannedResponseRow = { id: string; createdAt: Date; data: Prisma.JsonValue };

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
 * Pulls the storage URLs out of one page of scanned responses.
 *
 * Only file-upload answers hold storage URLs, and they are always stored as an array of strings.
 * Anything else under the same key is skipped rather than cast, so malformed data cannot produce a
 * bogus delete target.
 */
const collectFileUrlsFromPage = (
  responses: ScannedResponseRow[],
  fileUploadElementIds: Set<string>
): string[] => {
  const fileUrls: string[] = [];

  for (const response of responses) {
    for (const [elementId, answer] of Object.entries(response.data ?? {})) {
      if (fileUploadElementIds.has(elementId) && Array.isArray(answer)) {
        fileUrls.push(...answer.filter((url): url is string => typeof url === "string"));
      }
    }
  }

  return fileUrls;
};

/**
 * Collects the storage URLs a survey's file-upload answers point at, so they can be deleted once the
 * responses themselves are gone.
 *
 * Must run *before* the responses are deleted: the URLs only exist inside `response.data`, so once the
 * rows are gone there is nothing left to tell storage which objects are now unreferenced.
 *
 * Mirrors the single-response delete path (`findAndDeleteUploadedFilesInResponse` in
 * lib/response/service.ts): the id set comes from the union of `blocks` and `questions` via
 * `getSurveyFileUploadConfigs`, because a survey holds file uploads in either shape and keying off one
 * of them silently skips the other.
 */
const collectSurveyResponseFileUrls = async (
  surveyId: string
): Promise<{ fileUrls: string[]; workspaceId: string | undefined }> => {
  // getSurvey is reactCache'd and the reset action fetches the same survey immediately before calling
  // this, so it resolves from the request cache rather than issuing a second round-trip — and it hands
  // back typed blocks/questions instead of raw JSON columns needing a cast. This is also the source the
  // single-response cleanup path reads the survey from.
  const survey = await getSurvey(surveyId);

  if (!survey) {
    return { fileUrls: [], workspaceId: undefined };
  }

  const fileUploadElementIds = new Set(
    getSurveyFileUploadConfigs({ blocks: survey.blocks, questions: survey.questions }).map(
      (config) => config.id
    )
  );

  // No file-upload element in the survey's *current* definition, so there is no key this scan would
  // match — skip it. Note this is about today's blocks/questions, not the response history: answers
  // left by an upload element that was since deleted sit under an id no longer in the set, and are not
  // cleaned up here or by the single-response path. Widening the match to "any answer shaped like a
  // storage URL" is deliberately not the fix — see the PR's Open gaps for why that would let one
  // survey's reset delete another's live files.
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

    fileUrls.push(...collectFileUrlsFromPage(responses, fileUploadElementIds));

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

export const deleteResponsesAndDisplaysForSurvey = async (
  surveyId: string
): Promise<{ deletedResponsesCount: number; deletedDisplaysCount: number }> => {
  try {
    // Read the file-upload answers while the responses still exist (see collectSurveyResponseFileUrls).
    const { fileUrls, workspaceId } = await collectSurveyResponseFileUrls(surveyId);

    // Delete all responses for this survey

    const [deletedResponsesCount, deletedDisplaysCount] = await prisma.$transaction([
      prisma.response.deleteMany({
        where: {
          surveyId: surveyId,
        },
      }),
      prisma.display.deleteMany({
        where: {
          surveyId: surveyId,
        },
      }),
    ]);

    // Runs after the rows are gone so a storage failure can never delete files whose responses
    // survived, and chunked so the number of concurrent storage requests stays bounded.
    //
    // The responses are already committed as deleted at this point, so cleanup must not turn a
    // successful reset into a failed one: deleteResponseFileUrls already logs and swallows per-file
    // errors, and this guard covers an unexpected throw. The cost of failing here is objects left in
    // storage — the pre-existing behaviour — not a reset the caller has to retry.
    for (let i = 0; i < fileUrls.length; i += STORAGE_DELETE_CHUNK_SIZE) {
      const chunk = fileUrls.slice(i, i + STORAGE_DELETE_CHUNK_SIZE);
      try {
        await deleteResponseFileUrls(chunk, workspaceId);
      } catch (error) {
        logger.error(
          { error, surveyId, workspaceId, fileCount: chunk.length },
          "Failed to delete response files after resetting a survey"
        );
      }
    }

    return {
      deletedResponsesCount: deletedResponsesCount.count,
      deletedDisplaysCount: deletedDisplaysCount.count,
    };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }

    throw error;
  }
};

export const getQuotasSummary = async (surveyId: string) => {
  try {
    const quotas = await prisma.surveyQuota.findMany({
      where: {
        surveyId: surveyId,
      },
      select: {
        _count: {
          select: {
            quotaLinks: {
              where: {
                status: "screenedIn",
              },
            },
          },
        },
        id: true,
        name: true,
        limit: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return quotas.map((quota) => {
      const { _count, ...rest } = quota;
      const count = _count.quotaLinks;

      return {
        ...rest,
        count,
        percentage: quota.limit > 0 ? convertFloatTo2Decimal((count / quota.limit) * 100) : 0,
      };
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }

    throw error;
  }
};
