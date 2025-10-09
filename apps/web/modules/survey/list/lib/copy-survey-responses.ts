import "server-only";
import { createId } from "@paralleldrive/cuid2";
import { Prisma } from "@prisma/client";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import { DatabaseError, ResourceNotFoundError } from "@formbricks/types/errors";
import { createTag, getTag } from "@/lib/tag/service";

const STORAGE_URL_PATTERN = /\/storage\/([^/]+)\/(public|private)\/([^/\s]+)/g;
const BATCH_SIZE = 100;

interface CopyResponsesResult {
  copiedCount: number;
  errors: string[];
}

export const extractFileUrlsFromResponseData = (data: Prisma.JsonValue): string[] => {
  const urls: string[] = [];

  const extractFromValue = (value: any): void => {
    if (typeof value === "string") {
      const matches = value.matchAll(STORAGE_URL_PATTERN);
      for (const match of matches) {
        urls.push(match[0]);
      }
    } else if (Array.isArray(value)) {
      value.forEach(extractFromValue);
    } else if (value && typeof value === "object") {
      Object.values(value).forEach(extractFromValue);
    }
  };

  extractFromValue(data);
  return [...new Set(urls)];
};

export const downloadAndReuploadFile = async (
  fileUrl: string,
  sourceEnvironmentId: string,
  targetEnvironmentId: string
): Promise<string | null> => {
  try {
    const match = fileUrl.match(/\/storage\/([^/]+)\/(public|private)\/([^/\s]+)/);
    if (!match) {
      logger.error(`Invalid file URL format: ${fileUrl}`);
      return null;
    }

    const [, urlEnvironmentId, accessType, fileName] = match;

    if (urlEnvironmentId !== sourceEnvironmentId) {
      logger.warn(`File URL environment ID mismatch: ${urlEnvironmentId} vs ${sourceEnvironmentId}`);
    }

    const newFileName = fileName.includes("--fid--")
      ? fileName.replace(/--fid--[^.]+/, `--fid--${createId()}`)
      : `${fileName}--fid--${createId()}`;

    const newUrl = fileUrl.replace(
      `/storage/${urlEnvironmentId}/${accessType}/${fileName}`,
      `/storage/${targetEnvironmentId}/${accessType}/${newFileName}`
    );

    return newUrl;
  } catch (error) {
    logger.error(`Error processing file URL ${fileUrl}:`, error);
    return null;
  }
};

export const rewriteFileUrlsInData = (
  data: Prisma.JsonValue,
  urlMap: Map<string, string>
): Prisma.JsonValue => {
  const rewriteValue = (value: any): any => {
    if (typeof value === "string") {
      let result = value;
      urlMap.forEach((newUrl, oldUrl) => {
        result = result.replace(oldUrl, newUrl);
      });
      return result;
    } else if (Array.isArray(value)) {
      return value.map(rewriteValue);
    } else if (value && typeof value === "object") {
      const rewritten: any = {};
      for (const [key, val] of Object.entries(value)) {
        rewritten[key] = rewriteValue(val);
      }
      return rewritten;
    }
    return value;
  };

  return rewriteValue(data);
};

export const mapOrCreateContact = async (
  sourceContactId: string | null,
  targetEnvironmentId: string
): Promise<string | null> => {
  if (!sourceContactId) {
    return null;
  }

  try {
    const sourceContact = await prisma.contact.findUnique({
      where: { id: sourceContactId },
      include: { attributes: true },
    });

    if (!sourceContact) {
      return null;
    }

    let targetContact = await prisma.contact.findFirst({
      where: {
        environmentId: targetEnvironmentId,
      },
    });

    if (!targetContact) {
      targetContact = await prisma.contact.create({
        data: {
          environmentId: targetEnvironmentId,
        },
      });
    }

    return targetContact.id;
  } catch (error) {
    logger.error(`Error mapping contact ${sourceContactId}:`, error);
    return null;
  }
};

export const mapOrCreateTags = async (
  sourceTagIds: string[],
  targetEnvironmentId: string
): Promise<string[]> => {
  if (sourceTagIds.length === 0) {
    return [];
  }

  try {
    const sourceTags = await prisma.tag.findMany({
      where: { id: { in: sourceTagIds } },
    });

    const targetTagIds: string[] = [];

    for (const sourceTag of sourceTags) {
      let targetTag = await getTag(targetEnvironmentId, sourceTag.name);

      if (!targetTag) {
        targetTag = await createTag(targetEnvironmentId, sourceTag.name);
      }

      targetTagIds.push(targetTag.id);
    }

    return targetTagIds;
  } catch (error) {
    logger.error(`Error mapping tags:`, error);
    return [];
  }
};

const processResponseFileUrls = async (
  data: Prisma.JsonValue,
  sourceEnvironmentId: string,
  targetEnvironmentId: string
): Promise<Prisma.JsonValue> => {
  const fileUrls = extractFileUrlsFromResponseData(data);
  const urlMap = new Map<string, string>();

  for (const oldUrl of fileUrls) {
    const newUrl = await downloadAndReuploadFile(oldUrl, sourceEnvironmentId, targetEnvironmentId);
    if (newUrl) {
      urlMap.set(oldUrl, newUrl);
    }
  }

  return rewriteFileUrlsInData(data, urlMap);
};

const createResponseQuotaLinks = async (
  response: any,
  newResponseId: string,
  targetSurvey: any
): Promise<void> => {
  if (response.quotaLinks.length === 0 || targetSurvey.quotas.length === 0) {
    return;
  }

  const quotaNameToIdMap = new Map(targetSurvey.quotas.map((q: any) => [q.name, q.id]));

  const quotaLinksToCreate = response.quotaLinks
    .map((link: any) => {
      const targetQuotaId = quotaNameToIdMap.get(link.quota.name);
      if (targetQuotaId) {
        return {
          responseId: newResponseId,
          quotaId: targetQuotaId,
          status: link.status,
        };
      }
      return null;
    })
    .filter((link: any): link is NonNullable<typeof link> => link !== null);

  if (quotaLinksToCreate.length > 0) {
    await prisma.responseQuotaLink.createMany({
      data: quotaLinksToCreate,
      skipDuplicates: true,
    });
  }
};

const createResponseDisplay = async (
  response: any,
  targetSurveyId: string,
  targetContactId: string | null
): Promise<void> => {
  if (response.display && targetContactId) {
    await prisma.display.create({
      data: {
        surveyId: targetSurveyId,
        contactId: targetContactId,
        createdAt: response.display.createdAt,
        updatedAt: new Date(),
      },
    });
  }
};

const copySingleResponse = async (
  response: any,
  targetSurveyId: string,
  sourceEnvironmentId: string,
  targetEnvironmentId: string,
  targetSurvey: any
): Promise<void> => {
  const rewrittenData = await processResponseFileUrls(
    response.data,
    sourceEnvironmentId,
    targetEnvironmentId
  );

  const targetContactId = await mapOrCreateContact(response.contactId, targetEnvironmentId);

  const sourceTagIds = response.tags.map((t: any) => t.tag.id);
  const targetTagIds = await mapOrCreateTags(sourceTagIds, targetEnvironmentId);

  const newResponseId = createId();

  await prisma.response.create({
    data: {
      id: newResponseId,
      surveyId: targetSurveyId,
      finished: response.finished,
      data: rewrittenData,
      variables: response.variables,
      ttc: response.ttc,
      meta: response.meta,
      contactAttributes: response.contactAttributes,
      contactId: targetContactId,
      endingId: response.endingId,
      singleUseId: response.singleUseId,
      language: response.language,
      createdAt: response.createdAt,
      updatedAt: new Date(),
    },
  });

  if (targetTagIds.length > 0) {
    await prisma.tagsOnResponses.createMany({
      data: targetTagIds.map((tagId) => ({
        responseId: newResponseId,
        tagId,
      })),
      skipDuplicates: true,
    });
  }

  await createResponseQuotaLinks(response, newResponseId, targetSurvey);
  await createResponseDisplay(response, targetSurveyId, targetContactId);
};

export const copyResponsesForSurvey = async (params: {
  sourceSurveyId: string;
  targetSurveyId: string;
  sourceEnvironmentId: string;
  targetEnvironmentId: string;
  batchSize?: number;
}): Promise<CopyResponsesResult> => {
  const {
    sourceSurveyId,
    targetSurveyId,
    sourceEnvironmentId,
    targetEnvironmentId,
    batchSize = BATCH_SIZE,
  } = params;

  const result: CopyResponsesResult = {
    copiedCount: 0,
    errors: [],
  };

  try {
    const targetSurvey = await prisma.survey.findUnique({
      where: { id: targetSurveyId },
      include: { quotas: true },
    });

    if (!targetSurvey) {
      throw new ResourceNotFoundError("Target survey", targetSurveyId);
    }

    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      const responses = await prisma.response.findMany({
        where: { surveyId: sourceSurveyId },
        include: {
          tags: { include: { tag: true } },
          quotaLinks: { include: { quota: true } },
          display: true,
        },
        take: batchSize,
        skip: offset,
        orderBy: { createdAt: "asc" },
      });

      if (responses.length === 0) {
        break;
      }

      for (const response of responses) {
        try {
          await copySingleResponse(
            response,
            targetSurveyId,
            sourceEnvironmentId,
            targetEnvironmentId,
            targetSurvey
          );
          result.copiedCount++;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : "Unknown error";
          result.errors.push(`Response ${response.id}: ${errorMessage}`);
          logger.error(`Error copying response ${response.id}:`, error);
        }
      }

      if (responses.length < batchSize) {
        hasMore = false;
      } else {
        offset += batchSize;
      }
    }

    logger.info(
      `Copied ${result.copiedCount} responses from survey ${sourceSurveyId} to ${targetSurveyId}. Errors: ${result.errors.length}`
    );

    return result;
  } catch (error) {
    logger.error(`Fatal error copying responses:`, error);
    throw error instanceof DatabaseError ? error : new DatabaseError((error as Error).message);
  }
};
