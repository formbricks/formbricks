import "server-only";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import { DatabaseError, InvalidInputError } from "@formbricks/types/errors";
import type { TSurveyFilterCriteria } from "@formbricks/types/surveys/types";
import { buildWhereClause } from "@/modules/survey/lib/utils";
import type { TSurvey } from "../types/surveys";
import { surveySelect } from "./survey";

const SURVEY_LIST_CURSOR_VERSION = 1 as const;
const IN_PROGRESS_BUCKET = "inProgress" as const;
const OTHER_BUCKET = "other" as const;

type TSurveyRow = Prisma.SurveyGetPayload<{ select: typeof surveySelect }>;

const ZDateCursor = z.object({
  version: z.literal(SURVEY_LIST_CURSOR_VERSION),
  sortBy: z.enum(["updatedAt", "createdAt"]),
  value: z.iso.datetime(),
  id: z.string().min(1),
});

const ZNameCursor = z.object({
  version: z.literal(SURVEY_LIST_CURSOR_VERSION),
  sortBy: z.literal("name"),
  value: z.string(),
  id: z.string().min(1),
});

const ZRelevanceCursor = z.object({
  version: z.literal(SURVEY_LIST_CURSOR_VERSION),
  sortBy: z.literal("relevance"),
  bucket: z.enum([IN_PROGRESS_BUCKET, OTHER_BUCKET]),
  updatedAt: z.iso.datetime(),
  id: z.string().min(1),
});

const ZSurveyListPageCursor = z.union([ZDateCursor, ZNameCursor, ZRelevanceCursor]);

export type TSurveyListSort = NonNullable<TSurveyFilterCriteria["sortBy"]>;
export type TSurveyListPageCursor = z.infer<typeof ZSurveyListPageCursor>;

export type TSurveyListPage = {
  surveys: TSurvey[];
  nextCursor: string | null;
};

type TGetSurveyListPageOptions = {
  limit: number;
  cursor: TSurveyListPageCursor | null;
  sortBy: TSurveyListSort;
  filterCriteria?: TSurveyFilterCriteria;
};

type TCursorDirection = "asc" | "desc";

export function normalizeSurveyListSort(sortBy?: TSurveyFilterCriteria["sortBy"]): TSurveyListSort {
  return sortBy ?? "updatedAt";
}

export function encodeSurveyListPageCursor(cursor: TSurveyListPageCursor): string {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

export function decodeSurveyListPageCursor(
  encodedCursor: string,
  sortBy: TSurveyListSort
): TSurveyListPageCursor {
  try {
    const decodedJson = Buffer.from(encodedCursor, "base64url").toString("utf8");
    const parsedCursor = ZSurveyListPageCursor.parse(JSON.parse(decodedJson));

    if (parsedCursor.sortBy !== sortBy) {
      throw new InvalidInputError("The cursor does not match the requested sort order.");
    }

    return parsedCursor;
  } catch (error) {
    if (error instanceof InvalidInputError) {
      throw error;
    }

    throw new InvalidInputError("The cursor is invalid.");
  }
}

function mapSurveyRows(rows: TSurveyRow[]): TSurvey[] {
  return rows.map((row) => ({
    ...row,
    responseCount: row._count.responses,
  }));
}

function getSurveyOrderBy(
  sortBy: Exclude<TSurveyListSort, "relevance">
): Prisma.SurveyOrderByWithRelationInput[] {
  switch (sortBy) {
    case "name":
      return [{ name: "asc" }, { id: "asc" }];
    case "createdAt":
      return [{ createdAt: "desc" }, { id: "desc" }];
    case "updatedAt":
    default:
      return [{ updatedAt: "desc" }, { id: "desc" }];
  }
}

function buildDateCursorWhere(
  field: "createdAt" | "updatedAt",
  cursorValue: string,
  cursorId: string,
  direction: TCursorDirection
): Prisma.SurveyWhereInput {
  const comparisonOperator = direction === "desc" ? "lt" : "gt";
  const cursorDate = new Date(cursorValue);

  return {
    OR: [
      { [field]: { [comparisonOperator]: cursorDate } },
      {
        [field]: cursorDate,
        id: { [comparisonOperator]: cursorId },
      },
    ],
  };
}

function buildNameCursorWhere(cursorValue: string, cursorId: string): Prisma.SurveyWhereInput {
  return {
    OR: [
      { name: { gt: cursorValue } },
      {
        name: cursorValue,
        id: { gt: cursorId },
      },
    ],
  };
}

function buildStandardCursorWhere(
  sortBy: Exclude<TSurveyListSort, "relevance">,
  cursor: Extract<TSurveyListPageCursor, { sortBy: "updatedAt" | "createdAt" | "name" }>
): Prisma.SurveyWhereInput {
  switch (sortBy) {
    case "name":
      return buildNameCursorWhere(cursor.value, cursor.id);
    case "createdAt":
      return buildDateCursorWhere("createdAt", cursor.value, cursor.id, "desc");
    case "updatedAt":
    default:
      return buildDateCursorWhere("updatedAt", cursor.value, cursor.id, "desc");
  }
}

function buildBaseWhere(
  environmentId: string,
  filterCriteria?: TSurveyFilterCriteria,
  extraWhere?: Prisma.SurveyWhereInput
): Prisma.SurveyWhereInput {
  return {
    environmentId,
    ...buildWhereClause(filterCriteria),
    ...extraWhere,
  };
}

function getStandardNextCursor(
  survey: TSurveyRow,
  sortBy: Exclude<TSurveyListSort, "relevance">
): TSurveyListPageCursor {
  switch (sortBy) {
    case "name":
      return {
        version: SURVEY_LIST_CURSOR_VERSION,
        sortBy,
        value: survey.name,
        id: survey.id,
      };
    case "createdAt":
      return {
        version: SURVEY_LIST_CURSOR_VERSION,
        sortBy,
        value: survey.createdAt.toISOString(),
        id: survey.id,
      };
    case "updatedAt":
    default:
      return {
        version: SURVEY_LIST_CURSOR_VERSION,
        sortBy,
        value: survey.updatedAt.toISOString(),
        id: survey.id,
      };
  }
}

function getRelevanceNextCursor(
  survey: TSurveyRow,
  bucket: typeof IN_PROGRESS_BUCKET | typeof OTHER_BUCKET
): TSurveyListPageCursor {
  return {
    version: SURVEY_LIST_CURSOR_VERSION,
    sortBy: "relevance",
    bucket,
    updatedAt: survey.updatedAt.toISOString(),
    id: survey.id,
  };
}

async function findSurveyRows(
  environmentId: string,
  limit: number,
  sortBy: Exclude<TSurveyListSort, "relevance">,
  filterCriteria?: TSurveyFilterCriteria,
  cursor?: Extract<TSurveyListPageCursor, { sortBy: "updatedAt" | "createdAt" | "name" }> | null,
  extraWhere?: Prisma.SurveyWhereInput
): Promise<TSurveyRow[]> {
  const cursorWhere = cursor ? buildStandardCursorWhere(sortBy, cursor) : undefined;

  return prisma.survey.findMany({
    where: buildBaseWhere(environmentId, filterCriteria, {
      ...extraWhere,
      ...cursorWhere,
    }),
    select: surveySelect,
    orderBy: getSurveyOrderBy(sortBy),
    take: limit + 1,
  });
}

async function getStandardSurveyListPage(
  environmentId: string,
  options: TGetSurveyListPageOptions & { sortBy: Exclude<TSurveyListSort, "relevance"> }
): Promise<TSurveyListPage> {
  const surveyRows = await findSurveyRows(
    environmentId,
    options.limit,
    options.sortBy,
    options.filterCriteria,
    options.cursor as Extract<TSurveyListPageCursor, { sortBy: "updatedAt" | "createdAt" | "name" }> | null
  );

  const hasMore = surveyRows.length > options.limit;
  const pageRows = hasMore ? surveyRows.slice(0, options.limit) : surveyRows;
  const nextCursor =
    hasMore && pageRows.length > 0
      ? encodeSurveyListPageCursor(getStandardNextCursor(pageRows[pageRows.length - 1], options.sortBy))
      : null;

  return {
    surveys: mapSurveyRows(pageRows),
    nextCursor,
  };
}

async function findRelevanceRows(
  environmentId: string,
  limit: number,
  filterCriteria: TSurveyFilterCriteria | undefined,
  bucket: typeof IN_PROGRESS_BUCKET | typeof OTHER_BUCKET,
  cursor: Extract<TSurveyListPageCursor, { sortBy: "relevance" }> | null
): Promise<TSurveyRow[]> {
  const statusWhere: Prisma.SurveyWhereInput =
    bucket === IN_PROGRESS_BUCKET ? { status: "inProgress" } : { status: { not: "inProgress" } };
  const cursorWhere = cursor
    ? buildDateCursorWhere("updatedAt", cursor.updatedAt, cursor.id, "desc")
    : undefined;

  return prisma.survey.findMany({
    where: buildBaseWhere(environmentId, filterCriteria, {
      ...statusWhere,
      ...cursorWhere,
    }),
    select: surveySelect,
    orderBy: getSurveyOrderBy("updatedAt"),
    take: limit + 1,
  });
}

async function hasMoreRelevanceRowsInOtherBucket(
  environmentId: string,
  filterCriteria?: TSurveyFilterCriteria
): Promise<boolean> {
  const otherRows = await findRelevanceRows(environmentId, 1, filterCriteria, OTHER_BUCKET, null);
  return otherRows.length > 0;
}

async function getRelevanceSurveyListPage(
  environmentId: string,
  options: TGetSurveyListPageOptions & { sortBy: "relevance" }
): Promise<TSurveyListPage> {
  const pageRows: TSurveyRow[] = [];
  let remaining = options.limit;

  if (!options.cursor || options.cursor.bucket === IN_PROGRESS_BUCKET) {
    const inProgressRows = await findRelevanceRows(
      environmentId,
      remaining,
      options.filterCriteria,
      IN_PROGRESS_BUCKET,
      options.cursor?.bucket === IN_PROGRESS_BUCKET ? options.cursor : null
    );

    const hasMoreInProgress = inProgressRows.length > remaining;
    const inProgressPageRows = hasMoreInProgress ? inProgressRows.slice(0, remaining) : inProgressRows;
    pageRows.push(...inProgressPageRows);

    if (hasMoreInProgress && inProgressPageRows.length > 0) {
      return {
        surveys: mapSurveyRows(inProgressPageRows),
        nextCursor: encodeSurveyListPageCursor(
          getRelevanceNextCursor(inProgressPageRows[inProgressPageRows.length - 1], IN_PROGRESS_BUCKET)
        ),
      };
    }

    remaining -= inProgressPageRows.length;
  }

  if (remaining <= 0) {
    const hasOtherRows =
      pageRows.length > 0 &&
      (!options.cursor || options.cursor.bucket === IN_PROGRESS_BUCKET) &&
      (await hasMoreRelevanceRowsInOtherBucket(environmentId, options.filterCriteria));

    return {
      surveys: mapSurveyRows(pageRows),
      nextCursor:
        hasOtherRows && pageRows.length > 0
          ? encodeSurveyListPageCursor(
              getRelevanceNextCursor(pageRows[pageRows.length - 1], IN_PROGRESS_BUCKET)
            )
          : null,
    };
  }

  const otherRows = await findRelevanceRows(
    environmentId,
    remaining,
    options.filterCriteria,
    OTHER_BUCKET,
    options.cursor?.bucket === OTHER_BUCKET ? options.cursor : null
  );

  const hasMoreOther = otherRows.length > remaining;
  const otherPageRows = hasMoreOther ? otherRows.slice(0, remaining) : otherRows;
  pageRows.push(...otherPageRows);

  return {
    surveys: mapSurveyRows(pageRows),
    nextCursor:
      hasMoreOther && otherPageRows.length > 0
        ? encodeSurveyListPageCursor(
            getRelevanceNextCursor(otherPageRows[otherPageRows.length - 1], OTHER_BUCKET)
          )
        : null,
  };
}

export async function getSurveyListPage(
  environmentId: string,
  options: TGetSurveyListPageOptions
): Promise<TSurveyListPage> {
  try {
    if (options.sortBy === "relevance") {
      return await getRelevanceSurveyListPage(environmentId, {
        ...options,
        sortBy: "relevance",
      });
    }

    return await getStandardSurveyListPage(environmentId, {
      ...options,
      sortBy: options.sortBy,
    });
  } catch (error) {
    if (error instanceof InvalidInputError) {
      throw error;
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      logger.error(error, "Error getting paginated surveys");
      throw new DatabaseError(error.message);
    }

    throw error;
  }
}
