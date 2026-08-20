import "server-only";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { DatabaseError } from "@formbricks/types/errors";
import { TSurveyBlock } from "@formbricks/types/surveys/blocks";
import { TSurveyQuestion } from "@formbricks/types/surveys/types";
import { convertFloatTo2Decimal } from "@/app/(app)/workspaces/[workspaceId]/surveys/[surveyId]/(analysis)/summary/lib/utils";
import { deleteResponseFileUrls } from "@/modules/storage/lib/delete-response-files";
import { getSurveyFileUploadConfigs } from "@/modules/storage/utils";

/**
 * Responses are scanned in pages so resetting a survey with a large response count never loads every
 * response's data into memory at once.
 */
const RESPONSE_FILE_SCAN_PAGE_SIZE = 500;

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
  const survey = await prisma.survey.findUnique({
    where: { id: surveyId },
    select: { blocks: true, questions: true, workspaceId: true },
  });

  if (!survey) {
    return { fileUrls: [], workspaceId: undefined };
  }

  const fileUploadElementIds = new Set(
    getSurveyFileUploadConfigs({
      blocks: survey.blocks as TSurveyBlock[],
      questions: survey.questions as TSurveyQuestion[],
    }).map((config) => config.id)
  );

  // A survey with no file-upload element can have no uploads to clean up, so skip the response scan.
  if (fileUploadElementIds.size === 0) {
    return { fileUrls: [], workspaceId: survey.workspaceId };
  }

  const fileUrls: string[] = [];
  let cursor: string | undefined;

  for (;;) {
    const responses = await prisma.response.findMany({
      where: { surveyId },
      select: { id: true, data: true },
      orderBy: { id: "asc" },
      take: RESPONSE_FILE_SCAN_PAGE_SIZE,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });

    if (responses.length === 0) {
      break;
    }

    for (const response of responses) {
      for (const [elementId, answer] of Object.entries(response.data ?? {})) {
        // Only file-upload answers hold storage URLs, and they are always stored as an array. Anything
        // else under the same key is skipped rather than cast, so malformed data cannot produce a
        // bogus delete target.
        if (!fileUploadElementIds.has(elementId) || !Array.isArray(answer)) {
          continue;
        }

        fileUrls.push(...answer.filter((url): url is string => typeof url === "string"));
      }
    }

    if (responses.length < RESPONSE_FILE_SCAN_PAGE_SIZE) {
      break;
    }

    cursor = responses[responses.length - 1].id;
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
    // survived. deleteResponseFileUrls logs and swallows per-file errors, so a storage outage does not
    // fail the reset — it leaves objects behind, which is the pre-existing behaviour, not a new one.
    if (fileUrls.length > 0) {
      await deleteResponseFileUrls(fileUrls, workspaceId);
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
