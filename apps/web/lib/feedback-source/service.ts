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
  TFeedbackSourceElementScope,
  TFeedbackSourceFieldMappingCreateInput,
  TFeedbackSourceFormbricksMappingCreateInput,
  TFeedbackSourceUpdateInput,
  TFeedbackSourceWithMappings,
  ZFeedbackSourceCreateInput,
  ZFeedbackSourceUpdateInput,
} from "@formbricks/types/feedback-source";
import { isPrismaKnownRequestError, isUniqueConstraintError } from "@/lib/utils/prisma-error";
import { ITEMS_PER_PAGE } from "../constants";
import { getUniqueConstraintFields } from "../utils/prisma-constraint";
import { validateInputs } from "../utils/validate";

const selectFeedbackSourceWithMappings = {
  id: true,
  createdAt: true,
  updatedAt: true,
  name: true,
  type: true,
  status: true,
  importMode: true,
  elementScope: true,
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
  importMode: true,
  elementScope: true,
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

/**
 * Every formbricks_survey source mapping `surveyId`, regardless of status — the reconciliation read.
 *
 * Deliberately not filtered to `active` like the publish-path reader above, and deliberately not
 * request-cached: a paused source is exactly the one whose rows must not be allowed to drift. A
 * question retyped to contactInfo while a source is paused would otherwise keep its stale mapping,
 * and resuming the source does not reconcile (it submits no mappings), so the first response after a
 * resume would publish that answer. Keeping paused rows correct costs nothing and is what makes
 * resuming safe.
 */
export const getFeedbackSourcesToReconcile = async (
  surveyId: string
): Promise<TFeedbackSourceWithMappings[]> => {
  validateInputs([surveyId, ZId]);

  try {
    const feedbackSources = await prisma.feedbackSource.findMany({
      where: {
        type: "formbricks_survey",
        formbricksMappings: { some: { surveyId } },
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
};

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
        importMode: data.importMode,
        lastSyncAt: data.lastSyncAt,
      },
      select: selectFeedbackSource,
    });

    return feedbackSource;
  } catch (error) {
    if (isPrismaKnownRequestError(error, PrismaErrorType.RecordNotFound)) {
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
    if (isPrismaKnownRequestError(error, PrismaErrorType.RecordNotFound)) {
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
  const fields = getUniqueConstraintFields(error);
  // The driver adapter reports the underlying DB column names, so match the Prisma field name AND
  // its @map()-ed column name for mapped fields (sourceFieldId/targetFieldId). Unmapped fields
  // (elementId/surveyId) match by their identical column name.
  const has = (...names: string[]): boolean => names.some((name) => fields.includes(name));
  if (has("elementId", "surveyId")) {
    return new InvalidInputError("FEEDBACK_SOURCE_FORMBRICKS_MAPPING_DUPLICATE");
  }
  if (has("sourceFieldId", "source_field_id", "targetFieldId", "target_field_id")) {
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
  /** Derived in `resolveFormbricksMappingsInput`, never supplied by a caller. */
  elementScope: TFeedbackSourceElementScope;
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
          // Omitted by callers that do not set it, so Prisma applies the completedOnly default.
          importMode: data.importMode,
          workspaceId,
          feedbackDirectoryId: data.feedbackDirectoryId,
          createdBy: data.createdBy,
          // Only formbricks_survey sources have an element selection to scope; csv sources keep the
          // column's `specific` default, which reconciliation never reads for them.
          ...(mappingsInput?.type === "formbricks_survey"
            ? { elementScope: mappingsInput.elementScope }
            : {}),
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
      // ENG-2064: a source reconciliation flagged `error` has to be able to come back. Nothing else
      // clears the column — the edit modal sends only `{name, importMode}` and `status` is optional on
      // the input, so Prisma treats it as "leave alone" — while `getFeedbackSourcesBySurveyId` filters
      // `status: "active"`. Re-mapping a broken source repaired its rows and left it dark forever,
      // reachable only through the unrelated pause/resume toggle.
      //
      // Scoped deliberately: only when this save supplies mappings (so there is something to publish
      // again), only when the caller did not set `status` itself, and only from `error` — a `paused`
      // source stays paused, because pausing is an operator decision and re-mapping is not a request
      // to resume.
      // Only formbricks mappings: `status: "error"` is written by exactly one thing, the formbricks
      // mapping reconciler, so a csv source saving *field* mappings cannot be clearing an error it
      // could have caused. `updateFeedbackSourceWithMappingsAction` accepts fieldMappings regardless
      // of source type, so without the type check a csv save would silently un-error a formbricks
      // source that is still broken.
      const clearsErrorStatus =
        mappingsInput?.type === "formbricks_survey" &&
        mappingsInput.mappings.length > 0 &&
        data.status === undefined;

      await tx.feedbackSource.update({
        where: { id: feedbackSourceId, workspaceId },
        data: {
          name: data.name,
          status: data.status,
          importMode: data.importMode,
          lastSyncAt: data.lastSyncAt,
          // Re-derived from the selection being saved, in the same transaction as the mapping rows, so
          // the scope and the rows it describes can never drift apart. This is also what heals sources
          // created before the column existed: they default to `specific` until their next save.
          ...(mappingsInput?.type === "formbricks_survey"
            ? { elementScope: mappingsInput.elementScope }
            : {}),
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

      if (clearsErrorStatus) {
        // updateMany, not update: putting `status: "error"` in a `where` would fail to match every
        // healthy source and throw P2025 on the normal save path. This must be a no-op unless the
        // source really was errored.
        await tx.feedbackSource.updateMany({
          where: { id: feedbackSourceId, workspaceId, status: "error" },
          data: { status: "active" },
        });
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
    if (isPrismaKnownRequestError(error, PrismaErrorType.RecordNotFound)) {
      throw new ResourceNotFoundError("FeedbackSource", feedbackSourceId);
    }
    if (isPrismaKnownRequestError(error)) {
      throw new DatabaseError(error.message);
    }
    throw error;
  }
};
