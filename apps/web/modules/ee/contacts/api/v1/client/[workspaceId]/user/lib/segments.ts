import { cache as reactCache } from "react";
import { createCacheKey } from "@formbricks/cache";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { logger } from "@formbricks/logger";
import { ZId, ZString } from "@formbricks/types/common";
import { DatabaseError } from "@formbricks/types/errors";
import { TBaseFilters } from "@formbricks/types/segment";
import { cache } from "@/lib/cache";
import { effectivelyRestrictedWhere } from "@/lib/survey/visibility/predicate";
import { validateInputs } from "@/lib/utils/validate";
import { segmentFilterToPrismaQuery } from "@/modules/ee/contacts/segments/lib/filter/prisma-query";
import {
  type TContactInteractionData,
  hasAnyScopeInteractionFilter,
  tryEvaluateSurveyInteractionSegmentInMemory,
} from "@/modules/ee/contacts/segments/lib/filter/survey-interaction";

export const getSegments = reactCache(
  async (workspaceId: string) =>
    await cache.withCache(
      async () => {
        try {
          const segments = await prisma.segment.findMany({
            where: { workspaceId },
            select: {
              id: true,
              filters: true,
            },
          });

          return segments || [];
        } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError) {
            throw new DatabaseError(error.message);
          }

          throw error;
        }
      },
      createCacheKey.workspace.segments(workspaceId),
      60 * 1000 // 1 minutes in milliseconds
    )
);

/** A contact's displays and responses as the contact sync loads them. */
export type TContactInteractionRows = {
  displays: { surveyId: string; createdAt: Date }[];
  responses: { surveyId: string; createdAt: Date; finished: boolean }[];
};

/**
 * The rows the in-memory evaluator reads, each marked with whether it counts for `any` scope (ENG-6870:
 * only workspace-visible surveys do). The restricted surveys among the contact's own are looked up only
 * when `needsAnyScope`, in one query, so a workspace without `any` filters pays nothing on this hot path.
 */
export const buildContactInteractionData = async (
  workspaceId: string,
  rows: TContactInteractionRows,
  needsAnyScope: boolean
): Promise<TContactInteractionData> => {
  const surveyIds = [...new Set([...rows.displays, ...rows.responses].map((row) => row.surveyId))];
  const notCounted =
    needsAnyScope && surveyIds.length > 0
      ? new Set(
          (
            await prisma.survey.findMany({
              where: { workspaceId, id: { in: surveyIds }, AND: [effectivelyRestrictedWhere] },
              select: { id: true },
            })
          ).map((survey) => survey.id)
        )
      : new Set<string>();
  const counts = (surveyId: string) => !notCounted.has(surveyId);
  return {
    displays: rows.displays.map((row) => ({ ...row, countsForAnySurvey: counts(row.surveyId) })),
    responses: rows.responses.map((row) => ({ ...row, countsForAnySurvey: counts(row.surveyId) })),
  };
};

/**
 * The interaction rows marked for in-memory evaluation, or `null` when the `any`-scope lookup fails. Only
 * segments the in-memory path can answer read the rows, and only `any` needs the lookup. On failure the
 * interaction segments fall through to the Prisma path, which applies the same visibility rule itself, so
 * one failed query does not empty every other segment's result.
 */
const loadInteractionData = async (
  workspaceId: string,
  contactId: string,
  rows: TContactInteractionRows,
  segments: ReadonlyArray<{ filters: unknown }>
): Promise<TContactInteractionData | null> => {
  try {
    return await buildContactInteractionData(
      workspaceId,
      rows,
      segments.some((segment) => hasAnyScopeInteractionFilter((segment.filters ?? []) as TBaseFilters))
    );
  } catch (error) {
    logger.warn(
      { workspaceId, contactId, error },
      "Failed to classify interaction rows, evaluating interaction segments through the DB"
    );
    return null;
  }
};

/**
 * In-memory membership, or `null` when this segment needs the Prisma path: it reads more than interactions,
 * there is no interaction data, or evaluation threw. Failures are isolated per segment, like the DB path, so
 * one throw does not wipe out every already-computed segment, and the segment is not silently dropped.
 */
const evaluateInMemory = (
  filters: TBaseFilters,
  interactionData: TContactInteractionData | null,
  now: Date,
  segmentId: string,
  workspaceId: string
): boolean | null => {
  if (!interactionData) return null;
  try {
    return tryEvaluateSurveyInteractionSegmentInMemory(filters, interactionData, now);
  } catch (error) {
    logger.warn(
      { segmentId, workspaceId, error },
      "Failed to evaluate segment in memory, falling back to DB query"
    );
    return null;
  }
};

export const getPersonSegmentIds = async (
  workspaceId: string,
  contactId: string,
  contactUserId: string,
  deviceType: "phone" | "desktop",
  interactionRows: TContactInteractionRows
): Promise<string[]> => {
  try {
    validateInputs([workspaceId, ZId], [contactId, ZId], [contactUserId, ZString]);

    const segments = await getSegments(workspaceId);

    if (!segments || !Array.isArray(segments) || segments.length === 0) {
      return [];
    }

    const interactionData = await loadInteractionData(workspaceId, contactId, interactionRows, segments);

    // A single evaluation instant shared across every segment so all relative windows agree.
    const now = new Date();

    // Phase 1: Classify each segment.
    // - Empty filters → always matches.
    // - Interaction-only segments → evaluated in memory against the contact's already-loaded
    //   displays/responses, avoiding a DB round trip entirely (the hot-path optimization).
    // - Everything else → a Prisma membership check. Build the WHERE clauses sequentially to avoid
    //   connection pool contention: segmentFilterToPrismaQuery can itself hit the DB (e.g.
    //   unmigrated-row checks), so building all concurrently would saturate the pool.
    const alwaysMatchIds: string[] = [];
    const inMemoryMatchIds: string[] = [];
    const dbChecks: { segmentId: string; whereClause: Prisma.ContactWhereInput }[] = [];

    for (const segment of segments) {
      const filters = segment.filters as TBaseFilters;

      if (!filters?.length) {
        alwaysMatchIds.push(segment.id);
        continue;
      }

      const inMemoryResult = evaluateInMemory(filters, interactionData, now, segment.id, workspaceId);

      if (inMemoryResult !== null) {
        if (inMemoryResult) {
          inMemoryMatchIds.push(segment.id);
        }
        continue;
      }

      const queryResult = await segmentFilterToPrismaQuery(segment.id, filters, workspaceId, deviceType);

      if (!queryResult.ok) {
        logger.warn(
          { segmentId: segment.id, workspaceId, error: queryResult.error },
          "Failed to build Prisma query for segment, skipping"
        );
        continue;
      }

      dbChecks.push({ segmentId: segment.id, whereClause: queryResult.data.whereClause });
    }

    if (dbChecks.length === 0) {
      return [...alwaysMatchIds, ...inMemoryMatchIds];
    }

    // Phase 2: Execute the remaining membership checks in a single transaction.
    // Uses one connection instead of N concurrent ones, eliminating pool contention.
    const txResults = await prisma.$transaction(
      dbChecks.map(({ whereClause }) =>
        prisma.contact.findFirst({
          where: { id: contactId, ...whereClause },
          select: { id: true },
        })
      )
    );

    const dbMatchedIds = dbChecks.filter((_, i) => txResults[i] !== null).map(({ segmentId }) => segmentId);

    return [...alwaysMatchIds, ...inMemoryMatchIds, ...dbMatchedIds];
  } catch (error) {
    logger.warn({ workspaceId, contactId, error }, "Failed to get person segment IDs, returning empty array");
    return [];
  }
};
