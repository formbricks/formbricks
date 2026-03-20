import "server-only";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import { DatabaseError, InvalidInputError } from "@formbricks/types/errors";
import type { TSurveyFilterCriteria } from "@formbricks/types/surveys/types";
import { buildWhereClause } from "@/modules/survey/lib/utils";
import type { TSurvey } from "../types/surveys";
import { type TSurveyRow, mapSurveyRowsToSurveys, surveySelect } from "./survey-record";

const SURVEY_LIST_CURSOR_VERSION = 1 as const;
const IN_PROGRESS_BUCKET = "inProgress" as const;
const OTHER_BUCKET = "other" as const;

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
type TStandardSurveyListSort = Exclude<TSurveyListSort, "relevance">;
type TStandardSurveyListCursor = Extract<TSurveyListPageCursor, { sortBy: TStandardSurveyListSort }>;
type TRelevanceSurveyListCursor = Extract<TSurveyListPageCursor, { sortBy: "relevance" }>;
type TRelevanceBucket = typeof IN_PROGRESS_BUCKET | typeof OTHER_BUCKET;

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

function getSurveyOrderBy(sortBy: TStandardSurveyListSort): Prisma.SurveyOrderByWithRelationInput[] {
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
  sortBy: TStandardSurveyListSort,
  cursor: TStandardSurveyListCursor
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

function getStandardNextCursor(survey: TSurveyRow, sortBy: TStandardSurveyListSort): TSurveyListPageCursor {
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

function getRelevanceNextCursor(survey: TSurveyRow, bucket: TRelevanceBucket): TSurveyListPageCursor {
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
  sortBy: TStandardSurveyListSort,
  filterCriteria?: TSurveyFilterCriteria,
  cursor?: TStandardSurveyListCursor | null,
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

function getLastSurveyRow(rows: TSurveyRow[]): TSurveyRow | null {
  return rows.at(-1) ?? null;
}

function getPageRows<T>(rows: T[], limit: number): { pageRows: T[]; hasMore: boolean } {
  const hasMore = rows.length > limit;
  return {
    pageRows: hasMore ? rows.slice(0, limit) : rows,
    hasMore,
  };
}

function buildSurveyListPage(rows: TSurveyRow[], cursor: TSurveyListPageCursor | null): TSurveyListPage {
  return {
    surveys: mapSurveyRowsToSurveys(rows),
    nextCursor: cursor ? encodeSurveyListPageCursor(cursor) : null,
  };
}

async function getStandardSurveyListPage(
  environmentId: string,
  options: TGetSurveyListPageOptions & { sortBy: TStandardSurveyListSort }
): Promise<TSurveyListPage> {
  const surveyRows = await findSurveyRows(
    environmentId,
    options.limit,
    options.sortBy,
    options.filterCriteria,
    options.cursor as TStandardSurveyListCursor | null
  );

  const { pageRows, hasMore } = getPageRows(surveyRows, options.limit);
  const lastRow = getLastSurveyRow(pageRows);

  return buildSurveyListPage(
    pageRows,
    hasMore && lastRow ? getStandardNextCursor(lastRow, options.sortBy) : null
  );
}

async function findRelevanceRows(
  environmentId: string,
  limit: number,
  filterCriteria: TSurveyFilterCriteria | undefined,
  bucket: TRelevanceBucket,
  cursor: TRelevanceSurveyListCursor | null
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

function getRelevanceCursor(cursor: TSurveyListPageCursor | null): TRelevanceSurveyListCursor | null {
  if (cursor && cursor.sortBy !== "relevance") {
    throw new InvalidInputError("The cursor does not match the requested sort order.");
  }

  return cursor;
}

function getRelevanceBucketCursor(
  cursor: TRelevanceSurveyListCursor | null,
  bucket: TRelevanceBucket
): TRelevanceSurveyListCursor | null {
  return cursor?.bucket === bucket ? cursor : null;
}

function shouldReadInProgressBucket(cursor: TRelevanceSurveyListCursor | null): boolean {
  return !cursor || cursor.bucket === IN_PROGRESS_BUCKET;
}

function buildRelevancePage(rows: TSurveyRow[], bucket: TRelevanceBucket | null): TSurveyListPage {
  const lastRow = getLastSurveyRow(rows);

  return buildSurveyListPage(rows, bucket && lastRow ? getRelevanceNextCursor(lastRow, bucket) : null);
}

async function getInProgressRelevanceStep(
  environmentId: string,
  limit: number,
  filterCriteria: TSurveyFilterCriteria | undefined,
  cursor: TRelevanceSurveyListCursor | null
): Promise<{ pageRows: TSurveyRow[]; remaining: number; response: TSurveyListPage | null }> {
  const inProgressRows = await findRelevanceRows(
    environmentId,
    limit,
    filterCriteria,
    IN_PROGRESS_BUCKET,
    getRelevanceBucketCursor(cursor, IN_PROGRESS_BUCKET)
  );
  const { pageRows, hasMore } = getPageRows(inProgressRows, limit);

  return {
    pageRows,
    remaining: limit - pageRows.length,
    response: hasMore ? buildRelevancePage(pageRows, IN_PROGRESS_BUCKET) : null,
  };
}

async function buildInProgressOnlyRelevancePage(
  environmentId: string,
  rows: TSurveyRow[],
  filterCriteria: TSurveyFilterCriteria | undefined,
  cursor: TRelevanceSurveyListCursor | null
): Promise<TSurveyListPage> {
  const hasOtherRows =
    rows.length > 0 &&
    shouldReadInProgressBucket(cursor) &&
    (await hasMoreRelevanceRowsInOtherBucket(environmentId, filterCriteria));

  return buildRelevancePage(rows, hasOtherRows ? IN_PROGRESS_BUCKET : null);
}

async function getRelevanceSurveyListPage(
  environmentId: string,
  options: TGetSurveyListPageOptions & { sortBy: "relevance" }
): Promise<TSurveyListPage> {
  const relevanceCursor = getRelevanceCursor(options.cursor);
  const pageRows: TSurveyRow[] = [];
  let remaining = options.limit;

  if (shouldReadInProgressBucket(relevanceCursor)) {
    const inProgressStep = await getInProgressRelevanceStep(
      environmentId,
      remaining,
      options.filterCriteria,
      relevanceCursor
    );
    pageRows.push(...inProgressStep.pageRows);

    if (inProgressStep.response) {
      return inProgressStep.response;
    }

    remaining = inProgressStep.remaining;
  }

  if (remaining <= 0) {
    return await buildInProgressOnlyRelevancePage(
      environmentId,
      pageRows,
      options.filterCriteria,
      relevanceCursor
    );
  }

  const otherRows = await findRelevanceRows(
    environmentId,
    remaining,
    options.filterCriteria,
    OTHER_BUCKET,
    getRelevanceBucketCursor(relevanceCursor, OTHER_BUCKET)
  );
  const { pageRows: otherPageRows, hasMore: hasMoreOther } = getPageRows(otherRows, remaining);
  pageRows.push(...otherPageRows);

  return buildRelevancePage(pageRows, hasMoreOther ? OTHER_BUCKET : null);
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
