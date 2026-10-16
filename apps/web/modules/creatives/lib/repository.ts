import "server-only";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { ensureV3WorkspaceLanguages } from "@/app/api/v3/surveys/languages";
import { lockSurveyVisibility } from "@/lib/authzed/survey";
import { surveyOutboundVisibilitySelect } from "@/lib/survey/visibility/outbound";
import type { TCreativeDisplayStatus } from "./display-status";
import { creativeDisplayStatusSql } from "./display-status-sql";

/**
 * The creatives storage boundary: every Prisma call the creative service makes, and nothing else. The
 * service and the v3 operations hold the rules; tests replace this module to drive them.
 */

/** What a Destination check and the `destination` group need from the linked survey. */
const destinationSurveySelect = {
  id: true,
  name: true,
  type: true,
  status: true,
  archivedAt: true,
  singleUse: true,
  pin: true,
  ...surveyOutboundVisibilitySelect,
} satisfies Prisma.SurveySelect;

export type TDestinationSurveyFacts = Prisma.SurveyGetPayload<{ select: typeof destinationSurveySelect }>;

export const creativeRecordInclude = {
  triggers: { select: { actionClassId: true }, orderBy: { createdAt: "asc" } },
  languages: { select: { default: true, enabled: true, language: { select: { code: true } } } },
  survey: { select: destinationSurveySelect },
  creator: { select: { name: true } },
} satisfies Prisma.CreativeInclude;

export type TCreativeRecord = Prisma.CreativeGetPayload<{ include: typeof creativeRecordInclude }>;

export type TCreativeTx = Prisma.TransactionClient;

/** The columns a write sets on the row itself; triggers and languages travel beside it. */
export type TCreativeRowData = {
  name: string;
  status: TCreativeRecord["status"];
  publishedAt: Date | null;
  archivedAt: Date | null;
  content: Prisma.InputJsonValue;
  styling: Prisma.InputJsonValue;
  surveyId: string | null;
  linkUrl: string | null;
  showOn: TCreativeRecord["showOn"];
  showConditions: Prisma.InputJsonValue | null;
  displayPercentage: number | null;
  startAt: Date | null;
  endAt: Date | null;
};

export type TCreativeWriteData = {
  row: TCreativeRowData;
  /** Replaces every trigger when given; left alone when omitted. */
  actionClassIds?: string[];
  /** Replaces every language when given; left alone when omitted. */
  languages?: { languageId: string; default: boolean; enabled: boolean }[];
};

const toRowInput = (row: TCreativeRowData) => ({
  ...row,
  showConditions: row.showConditions ?? Prisma.DbNull,
});

export const findCreativeWorkspaceId = async (creativeId: string): Promise<string | null> => {
  const creative = await prisma.creative.findUnique({
    where: { id: creativeId },
    select: { workspaceId: true },
  });
  return creative?.workspaceId ?? null;
};

export const findCreativeRecord = (
  creativeId: string,
  workspaceId: string
): Promise<TCreativeRecord | null> =>
  prisma.creative.findFirst({ where: { id: creativeId, workspaceId }, include: creativeRecordInclude });

export type TCreativeListSortBy = "updatedAt" | "createdAt" | "name";

export type TCreativePageQuery = {
  workspaceId: string;
  sortBy: TCreativeListSortBy;
  /** The last row of the previous page: its sort value (ISO instant or name) and id. */
  after: { value: string; id: string } | null;
  /** Rows to read; the caller asks for one more than a page to learn whether another follows. */
  take: number;
  name?: string;
  types?: string[];
  surveyId?: string;
  /** Derived statuses to keep; omitted keeps every status but `archived`. */
  displayStatuses?: TCreativeDisplayStatus[];
  now: Date;
};

const SORT_COLUMNS: Record<TCreativeListSortBy, { column: Prisma.Sql; direction: "ASC" | "DESC" }> = {
  updatedAt: { column: Prisma.raw('c."updated_at"'), direction: "DESC" },
  createdAt: { column: Prisma.raw('c."created_at"'), direction: "DESC" },
  name: { column: Prisma.raw('c."name"'), direction: "ASC" },
};

const escapeLikePattern = (value: string): string => value.replace(/[\\%_]/g, (match) => `\\${match}`);

/**
 * One keyset page of a workspace's creatives, in order. Raw SQL because the status filter is the
 * derived `displayStatus` (the SQL twin) and the page condition a row comparison, neither of which
 * Prisma's query builder can express; the rows themselves are then read through Prisma.
 */
export const findCreativeRecordsPage = async (query: TCreativePageQuery): Promise<TCreativeRecord[]> => {
  const sort = SORT_COLUMNS[query.sortBy];
  const displayStatus = creativeDisplayStatusSql(
    {
      status: Prisma.raw('c."status"'),
      archivedAt: Prisma.raw('c."archivedAt"'),
      startAt: Prisma.raw('c."startAt"'),
      endAt: Prisma.raw('c."endAt"'),
      surveyStatus: Prisma.raw('s."status"'),
      surveyArchivedAt: Prisma.raw('s."archivedAt"'),
    },
    query.now
  );

  const conditions: Prisma.Sql[] = [Prisma.sql`c."workspaceId" = ${query.workspaceId}`];
  if (query.name) {
    conditions.push(Prisma.sql`c."name" ILIKE ${`%${escapeLikePattern(query.name)}%`}`);
  }
  if (query.types?.length) {
    conditions.push(Prisma.sql`c."type"::text IN (${Prisma.join(query.types)})`);
  }
  if (query.surveyId) {
    conditions.push(Prisma.sql`c."surveyId" = ${query.surveyId}`);
  }
  conditions.push(
    query.displayStatuses?.length
      ? Prisma.sql`${displayStatus} IN (${Prisma.join(query.displayStatuses)})`
      : Prisma.sql`c."archivedAt" IS NULL`
  );
  if (query.after) {
    const value = query.sortBy === "name" ? query.after.value : new Date(query.after.value);
    const comparison = Prisma.raw(sort.direction === "DESC" ? "<" : ">");
    conditions.push(Prisma.sql`(${sort.column}, c."id") ${comparison} (${value}, ${query.after.id})`);
  }

  const direction = Prisma.raw(sort.direction);
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT c."id"
    FROM "Creative" c
    LEFT JOIN "Survey" s ON s."id" = c."surveyId"
    WHERE ${Prisma.join(conditions, " AND ")}
    ORDER BY ${sort.column} ${direction}, c."id" ${direction}
    LIMIT ${query.take}
  `;
  if (rows.length === 0) return [];

  const records = await prisma.creative.findMany({
    where: { id: { in: rows.map(({ id }) => id) }, workspaceId: query.workspaceId },
    include: creativeRecordInclude,
  });
  const byId = new Map(records.map((record) => [record.id, record]));
  return rows.flatMap(({ id }) => byId.get(id) ?? []);
};

export const runInCreativeTransaction = <T>(fn: (tx: TCreativeTx) => Promise<T>): Promise<T> =>
  prisma.$transaction(fn);

/**
 * The survey a write links, under the survey's visibility lock (the one a Restrict takes), so linking and
 * restricting can't interleave (T6). `null` when no such survey is in the workspace.
 */
export const lockDestinationSurvey = async (
  tx: TCreativeTx,
  surveyId: string,
  workspaceId: string
): Promise<TDestinationSurveyFacts | null> => {
  await lockSurveyVisibility(tx, surveyId);
  return tx.survey.findFirst({ where: { id: surveyId, workspaceId }, select: destinationSurveySelect });
};

export const findWorkspaceActionClassIds = async (
  tx: TCreativeTx,
  workspaceId: string,
  actionClassIds: string[]
): Promise<string[]> => {
  if (actionClassIds.length === 0) return [];
  const found = await tx.actionClass.findMany({
    where: { id: { in: actionClassIds }, workspaceId },
    select: { id: true },
  });
  return found.map(({ id }) => id);
};

/** The workspace `Language` rows for these codes, created when missing (as v3 surveys do). */
export const ensureCreativeLanguages = async (
  workspaceId: string,
  languages: { code: string; default: boolean; enabled: boolean }[]
): Promise<NonNullable<TCreativeWriteData["languages"]>> => {
  const ensured = await ensureV3WorkspaceLanguages(workspaceId, languages);
  return ensured.map(({ language, default: isDefault, enabled }) => ({
    languageId: language.id,
    default: isDefault,
    enabled,
  }));
};

export const insertCreativeRecord = (
  tx: TCreativeTx,
  input: {
    workspaceId: string;
    type: TCreativeRecord["type"];
    createdBy: string | null;
  } & Required<TCreativeWriteData>
): Promise<TCreativeRecord> =>
  tx.creative.create({
    data: {
      ...toRowInput(input.row),
      type: input.type,
      workspaceId: input.workspaceId,
      createdBy: input.createdBy,
      triggers: { create: input.actionClassIds.map((actionClassId) => ({ actionClassId })) },
      languages: { create: input.languages },
    },
    include: creativeRecordInclude,
  });

/** Replaces the row's columns, and its triggers and languages when given: the stored state becomes `data`. */
export const replaceCreativeRecord = (
  tx: TCreativeTx,
  creativeId: string,
  workspaceId: string,
  data: TCreativeWriteData
): Promise<TCreativeRecord> =>
  tx.creative.update({
    where: { id: creativeId, workspaceId },
    data: {
      ...toRowInput(data.row),
      ...(data.actionClassIds && {
        triggers: {
          deleteMany: {},
          create: data.actionClassIds.map((actionClassId) => ({ actionClassId })),
        },
      }),
      ...(data.languages && { languages: { deleteMany: {}, create: data.languages } }),
    },
    include: creativeRecordInclude,
  });

/** Deletes the creative; its triggers and languages (and, later, its counts) go with it by cascade. */
export const deleteCreativeRecord = async (creativeId: string, workspaceId: string): Promise<void> => {
  await prisma.creative.delete({ where: { id: creativeId, workspaceId } });
};
