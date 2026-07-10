import "server-only";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import type { PrismaClientKnownRequestError } from "@formbricks/database/prisma";
import { PrismaErrorType } from "@formbricks/database/types/error";
import { logger } from "@formbricks/logger";
import { ZId, ZOptionalNumber } from "@formbricks/types/common";
import { DatabaseError, InvalidInputError, ResourceNotFoundError } from "@formbricks/types/errors";
import {
  TFeedbackSource,
  TFeedbackSourceCreateInput,
  TFeedbackSourceFieldMappingCreateInput,
  TFeedbackSourceFormbricksMappingCreateInput,
  TFeedbackSourceUpdateInput,
  TFeedbackSourceWithMappings,
  ZFeedbackSourceCreateInput,
  ZFeedbackSourceUpdateInput,
} from "@formbricks/types/feedback-source";
import { isPrismaKnownRequestError, isUniqueConstraintError } from "@/lib/utils/prisma-error";
import { ITEMS_PER_PAGE } from "../constants";
import { validateInputs } from "../utils/validate";

const selectFeedbackSourceWithMappings = {
  id: true,
  createdAt: true,
  updatedAt: true,
  name: true,
  type: true,
  status: true,
  workspaceId: true,
  feedbackDirectoryId: true,
  lastSyncAt: true,
  createdBy: true,
  creator: { select: { name: true } },
  formbricksMappings: {
    select: {
      id: true,
      createdAt: true,
      feedbackSourceId: true,
      workspaceId: true,
      surveyId: true,
      elementId: true,
      hubFieldType: true,
      customFieldLabel: true,
    },
  },
  fieldMappings: {
    select: {
      id: true,
      createdAt: true,
      feedbackSourceId: true,
      workspaceId: true,
      sourceFieldId: true,
      targetFieldId: true,
      staticValue: true,
    },
  },
} satisfies Prisma.FeedbackSourceSelect;

const selectFeedbackSource = {
  id: true,
  createdAt: true,
  updatedAt: true,
  name: true,
  type: true,
  status: true,
  workspaceId: true,
  feedbackDirectoryId: true,
  lastSyncAt: true,
  createdBy: true,
} satisfies Prisma.FeedbackSourceSelect;

type PrismaFeedbackSourceWithCreator = Prisma.FeedbackSourceGetPayload<{
  select: typeof selectFeedbackSourceWithMappings;
}>;

const mapFeedbackSourceWithMappings = (
  feedbackSource: PrismaFeedbackSourceWithCreator
): TFeedbackSourceWithMappings => {
  const { creator, ...rest } = feedbackSource;
  return { ...rest, creatorName: creator?.name ?? null } as TFeedbackSourceWithMappings;
};

export const getFeedbackSourcesWithMappings = reactCache(
  async (workspaceId: string, page?: number): Promise<TFeedbackSourceWithMappings[]> => {
    validateInputs([workspaceId, ZId], [page, ZOptionalNumber]);

    try {
      const feedbackSources = await prisma.feedbackSource.findMany({
        where: {
          workspaceId,
        },
        select: selectFeedbackSourceWithMappings,
        orderBy: {
          createdAt: "desc",
        },
        take: page ? ITEMS_PER_PAGE : undefined,
        skip: page ? ITEMS_PER_PAGE * (page - 1) : undefined,
      });

      return feedbackSources.map(mapFeedbackSourceWithMappings);
    } catch (error) {
      if (isPrismaKnownRequestError(error)) {
        throw new DatabaseError(error.message);
      }
      throw error;
    }
  }
);

export const getFeedbackSourceWithMappingsById = reactCache(
  async (feedbackSourceId: string, workspaceId: string): Promise<TFeedbackSourceWithMappings | null> => {
    validateInputs([feedbackSourceId, ZId], [workspaceId, ZId]);

    try {
      const feedbackSource = await prisma.feedbackSource.findUnique({
        where: {
          id: feedbackSourceId,
          workspaceId,
        },
        select: selectFeedbackSourceWithMappings,
      });

      return feedbackSource ? mapFeedbackSourceWithMappings(feedbackSource) : null;
    } catch (error) {
      if (isPrismaKnownRequestError(error)) {
        throw new DatabaseError(error.message);
      }
      throw error;
    }
  }
);

export const getFeedbackSourcesBySurveyId = reactCache(
  async (surveyId: string): Promise<TFeedbackSourceWithMappings[]> => {
    validateInputs([surveyId, ZId]);

    try {
      const feedbackSources = await prisma.feedbackSource.findMany({
        where: {
          type: "formbricks_survey",
          status: "active",
          formbricksMappings: {
            some: {
              surveyId,
            },
          },
        },
        select: selectFeedbackSourceWithMappings,
      });

      return feedbackSources.map(mapFeedbackSourceWithMappings);
    } catch (error) {
      if (isPrismaKnownRequestError(error)) {
        throw new DatabaseError(error.message);
      }
      throw error;
    }
  }
);

export const updateFeedbackSource = async (
  feedbackSourceId: string,
  workspaceId: string,
  data: TFeedbackSourceUpdateInput
): Promise<TFeedbackSource> => {
  validateInputs([feedbackSourceId, ZId], [data, ZFeedbackSourceUpdateInput], [workspaceId, ZId]);

  try {
    const feedbackSource = await prisma.feedbackSource.update({
      where: {
        id: feedbackSourceId,
        workspaceId,
      },
      data: {
        name: data.name,
        status: data.status,
        lastSyncAt: data.lastSyncAt,
      },
      select: selectFeedbackSource,
    });

    return feedbackSource;
  } catch (error) {
    if (isPrismaKnownRequestError(error, PrismaErrorType.RelatedRecordNotFound)) {
      throw new ResourceNotFoundError("FeedbackSource", feedbackSourceId);
    }
    if (isPrismaKnownRequestError(error)) {
      throw new DatabaseError(error.message);
    }
    throw error;
  }
};

export const deleteFeedbackSource = async (
  feedbackSourceId: string,
  workspaceId: string
): Promise<TFeedbackSource> => {
  validateInputs([feedbackSourceId, ZId], [workspaceId, ZId]);

  try {
    const feedbackSource = await prisma.feedbackSource.delete({
      where: {
        id: feedbackSourceId,
        workspaceId,
      },
      select: selectFeedbackSource,
    });

    return feedbackSource;
  } catch (error) {
    if (isPrismaKnownRequestError(error, PrismaErrorType.RelatedRecordNotFound)) {
      throw new ResourceNotFoundError("FeedbackSource", feedbackSourceId);
    }
    if (isPrismaKnownRequestError(error)) {
      throw new DatabaseError(error.message);
    }
    throw error;
  }
};

// -- Composite functions --

const mapUniqueConstraintError = (error: PrismaClientKnownRequestError): InvalidInputError => {
  const target = error.meta?.target;
  const targetFields = Array.isArray(target) ? (target as string[]) : [];
  if (targetFields.includes("elementId") || targetFields.includes("surveyId")) {
    return new InvalidInputError("FEEDBACK_SOURCE_FORMBRICKS_MAPPING_DUPLICATE");
  }
  if (targetFields.includes("sourceFieldId") || targetFields.includes("targetFieldId")) {
    return new InvalidInputError("FEEDBACK_SOURCE_FIELD_MAPPING_DUPLICATE");
  }
  return new InvalidInputError("FEEDBACK_SOURCE_NAME_DUPLICATE");
};

// Recursively collect every string in a Prisma error `meta`. Prisma 7's driver adapters (this repo
// uses @prisma/adapter-pg) nest the real constraint name deep under
// `meta.driverAdapterError.cause` (constraint.index / originalMessage), so a shallow scan of
// `Object.values(meta)` would only see `modelName` and miss it — mis-mapping the violation.
const collectMetaStrings = (value: unknown): string[] => {
  if (typeof value === "string") {
    return [value];
  }
  if (Array.isArray(value)) {
    return value.flatMap(collectMetaStrings);
  }
  if (value && typeof value === "object") {
    return Object.values(value).flatMap(collectMetaStrings);
  }
  return [];
};

/**
 * Detects a foreign-key violation of the composite FeedbackSource -> FeedbackDirectoryWorkspace
 * constraint (ENG-1148). The Prisma P2003 `meta` shape varies by version/adapter, so we deep-scan
 * every string in it for the composite-FK constraint name; the substring fallback (for shapes that
 * only expose columns) is anchored to the `FeedbackSource` table so an unrelated future junction
 * table carrying both column names can't be misclassified. Other FK violations fall through to the
 * caller's generic handling.
 */
export const isDirectoryWorkspaceFkViolation = (error: PrismaClientKnownRequestError): boolean => {
  if (error.code !== PrismaErrorType.ForeignKeyConstraintViolation) {
    return false;
  }
  const haystack = collectMetaStrings(error.meta).join(" ");
  return (
    haystack.includes("FeedbackSource_feedbackDirectoryId_workspaceId_fkey") ||
    (haystack.includes("FeedbackSource") &&
      haystack.includes("feedbackDirectoryId") &&
      haystack.includes("workspaceId"))
  );
};

export type TFormbricksMappingsInput = {
  type: "formbricks_survey";
  mappings: TFeedbackSourceFormbricksMappingCreateInput[];
};

export type TFieldMappingsInput = {
  type: "field";
  mappings: TFeedbackSourceFieldMappingCreateInput[];
};

export type TMappingsInput = TFormbricksMappingsInput | TFieldMappingsInput;

export const createFeedbackSourceWithMappings = async (
  workspaceId: string,
  data: TFeedbackSourceCreateInput,
  mappingsInput?: TMappingsInput
): Promise<TFeedbackSourceWithMappings> => {
  validateInputs([workspaceId, ZId], [data, ZFeedbackSourceCreateInput]);

  try {
    const result = await prisma.$transaction(async (tx) => {
      const feedbackSource = await tx.feedbackSource.create({
        data: {
          name: data.name,
          type: data.type,
          workspaceId,
          feedbackDirectoryId: data.feedbackDirectoryId,
          createdBy: data.createdBy,
        },
      });

      if (mappingsInput?.type === "formbricks_survey") {
        await Promise.all(
          mappingsInput.mappings.map((mapping) =>
            tx.feedbackSourceFormbricksMapping.create({
              data: {
                feedbackSourceId: feedbackSource.id,
                workspaceId,
                surveyId: mapping.surveyId,
                elementId: mapping.elementId,
                hubFieldType: mapping.hubFieldType,
                customFieldLabel: mapping.customFieldLabel,
              },
            })
          )
        );
      } else if (mappingsInput?.type === "field") {
        await Promise.all(
          mappingsInput.mappings.map((mapping) =>
            tx.feedbackSourceFieldMapping.create({
              data: {
                feedbackSourceId: feedbackSource.id,
                workspaceId,
                sourceFieldId: mapping.sourceFieldId,
                targetFieldId: mapping.targetFieldId,
                staticValue: mapping.staticValue,
              },
            })
          )
        );
      }

      return tx.feedbackSource.findUniqueOrThrow({
        where: { id: feedbackSource.id },
        select: selectFeedbackSourceWithMappings,
      });
    });

    return mapFeedbackSourceWithMappings(result);
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw mapUniqueConstraintError(error);
    }
    if (isPrismaKnownRequestError(error)) {
      if (isDirectoryWorkspaceFkViolation(error)) {
        logger.error(
          { workspaceId, feedbackDirectoryId: data.feedbackDirectoryId, meta: error.meta },
          "FeedbackSource create violated directory-workspace assignment FK"
        );
        throw new InvalidInputError("FEEDBACK_SOURCE_DIRECTORY_NOT_ASSIGNED_TO_WORKSPACE");
      }
      throw new DatabaseError(error.message);
    }
    throw error;
  }
};

export const updateFeedbackSourceWithMappings = async (
  feedbackSourceId: string,
  workspaceId: string,
  data: TFeedbackSourceUpdateInput,
  mappingsInput?: TMappingsInput
): Promise<TFeedbackSourceWithMappings> => {
  validateInputs([feedbackSourceId, ZId], [data, ZFeedbackSourceUpdateInput], [workspaceId, ZId]);

  try {
    const result = await prisma.$transaction(async (tx) => {
      await tx.feedbackSource.update({
        where: { id: feedbackSourceId, workspaceId },
        data: {
          name: data.name,
          status: data.status,
          lastSyncAt: data.lastSyncAt,
        },
      });

      if (mappingsInput?.type === "formbricks_survey") {
        await tx.feedbackSourceFormbricksMapping.deleteMany({
          where: { feedbackSourceId, workspaceId },
        });

        await Promise.all(
          mappingsInput.mappings.map((mapping) =>
            tx.feedbackSourceFormbricksMapping.create({
              data: {
                feedbackSourceId,
                workspaceId,
                surveyId: mapping.surveyId,
                elementId: mapping.elementId,
                hubFieldType: mapping.hubFieldType,
                customFieldLabel: mapping.customFieldLabel,
              },
            })
          )
        );
      } else if (mappingsInput?.type === "field") {
        await tx.feedbackSourceFieldMapping.deleteMany({
          where: { feedbackSourceId, workspaceId },
        });

        await Promise.all(
          mappingsInput.mappings.map((mapping) =>
            tx.feedbackSourceFieldMapping.create({
              data: {
                feedbackSourceId,
                workspaceId,
                sourceFieldId: mapping.sourceFieldId,
                targetFieldId: mapping.targetFieldId,
                staticValue: mapping.staticValue,
              },
            })
          )
        );
      }

      return tx.feedbackSource.findUniqueOrThrow({
        where: { id: feedbackSourceId },
        select: selectFeedbackSourceWithMappings,
      });
    });

    return mapFeedbackSourceWithMappings(result);
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw mapUniqueConstraintError(error);
    }
    if (isPrismaKnownRequestError(error, PrismaErrorType.RelatedRecordNotFound)) {
      throw new ResourceNotFoundError("FeedbackSource", feedbackSourceId);
    }
    if (isPrismaKnownRequestError(error)) {
      throw new DatabaseError(error.message);
    }
    throw error;
  }
};
