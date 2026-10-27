import "server-only";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { ZId } from "@formbricks/types/common";
import { DatabaseError, ResourceNotFoundError } from "@formbricks/types/errors";
import { TResponseFilterCriteria, ZResponseFilterCriteria } from "@formbricks/types/responses";
import { TSurvey } from "@formbricks/types/surveys/types";
import { getSurveyFileUploadElementIds, resolveStorageUrlsInObject } from "@/modules/storage/utils";
import { type TResponseCursor, whereAfterResponseCursor } from "../response/pagination";
import { buildWhereClause } from "../response/where-clause";
import { getSurvey } from "../survey/service";
import { validateInputs } from "../utils/validate";
import { type TAnalysisResponse, createAnalysisRowBuilder } from "./row-builder";
import type { TAnalysisExport, TAnalysisExportInput, TAnalysisResponseFields } from "./types";
import { createUnmappedCollector } from "./unmapped-collector";

export type {
  TAnalysisCell,
  TAnalysisColumn,
  TAnalysisExport,
  TAnalysisExportInput,
  TAnalysisExportSummary,
  TAnalysisResponseFields,
  TAnalysisRow,
  TAnswerDisplay,
  TUnmappedValue,
} from "./types";
export { UNMAPPED_PREFIX } from "./types";

const DEFAULT_BATCH_SIZE = 1000;
const MAX_BATCH_SIZE = 5000;

/**
 * The response filter with Low quality handled the way the Analysis export wants it (ADR 0017): left
 * out unless the filter selects Low quality. Done here, not in `buildWhereClause`, because that
 * builder also feeds Summary, where Low quality responses keep counting.
 *
 * `included` is every response the export writes. `lowQualityLeftOut` is the same filter restricted
 * to Low quality, or `null` when nothing is left out (the filter itself selects Low quality).
 */
export const buildAnalysisWhere = (
  survey: TSurvey,
  filter?: TResponseFilterCriteria
): { included: Prisma.ResponseWhereInput; lowQualityLeftOut: Prisma.ResponseWhereInput | null } => {
  const base: Prisma.ResponseWhereInput = { surveyId: survey.id, ...buildWhereClause(survey, filter) };
  if (filter?.outcome) return { included: base, lowQualityLeftOut: null };
  return {
    included: { AND: [base, { outcome: null }] },
    lowQualityLeftOut: { AND: [base, { outcome: "lowQuality" }] },
  };
};

/** Selects only what the chosen fields need: the lean shape the ticket asks for in place of `getResponses`. */
export const buildAnalysisSelect = (fields: TAnalysisResponseFields, isQuotasAllowed: boolean) =>
  ({
    id: true,
    createdAt: true,
    finished: true,
    language: true,
    outcome: true,
    data: true,
    ...(fields.embeddedData || fields.metadata ? { variables: true } : {}),
    ...(fields.metadata ? { surveyId: true, updatedAt: true, meta: true, ttc: true } : {}),
    ...(fields.tags ? { tags: { select: { tag: { select: { name: true } } } } } : {}),
    ...(fields.contact
      ? {
          contact: {
            select: {
              id: true,
              attributes: {
                where: { attributeKey: { key: "userId" } },
                select: { value: true },
              },
            },
          },
        }
      : {}),
    ...(fields.quotas && isQuotasAllowed
      ? {
          quotaLinks: {
            where: { status: "screenedIn" as const },
            select: { quota: { select: { name: true } } },
          },
        }
      : {}),
  }) satisfies Prisma.ResponseSelect;

/** What `buildAnalysisSelect` returns for the widest field selection; absent keys were not selected. */
type TAnalysisSelected = {
  id: string;
  createdAt: Date;
  finished: boolean;
  language: string | null;
  outcome: string | null;
  data: unknown;
  tags?: { tag: { name: string } }[];
  contact?: { id: string; attributes: { value: string }[] } | null;
  quotaLinks?: { quota: { name: string } }[];
  variables?: Record<string, string | number>;
  meta?: Record<string, unknown>;
  ttc?: Record<string, number>;
  surveyId?: string;
  updatedAt?: Date;
};

const toAnalysisResponse = (row: TAnalysisSelected): TAnalysisResponse => ({
  id: row.id,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
  surveyId: row.surveyId,
  finished: row.finished,
  language: row.language,
  outcome: row.outcome,
  data: row.data as TAnalysisResponse["data"],
  variables: row.variables,
  meta: row.meta,
  ttc: row.ttc,
  tags: row.tags?.map(({ tag }) => tag.name),
  quotas: row.quotaLinks?.map(({ quota }) => quota.name),
  contact: row.contact ? { id: row.contact.id, userId: row.contact.attributes[0]?.value } : null,
});

/**
 * Opens an Analysis export: loads the survey once, counts, builds the column plan and hands back a
 * single-use row stream. Rows are read by cursor in batches (`createdAt desc, id desc`), so memory
 * stays at one batch plus the Unmapped values list, which is capped. One query per batch, none per
 * response. Throws `ResourceNotFoundError` for an unknown survey; the caller owns authorization.
 */
export const openAnalysisExport = async (input: TAnalysisExportInput): Promise<TAnalysisExport> => {
  validateInputs([input.surveyId, ZId], [input.filter, ZResponseFilterCriteria.optional()]);
  const fields = input.fields ?? {};
  const isQuotasAllowed = input.isQuotasAllowed ?? false;
  const batchSize = Math.min(Math.max(input.batchSize ?? DEFAULT_BATCH_SIZE, 1), MAX_BATCH_SIZE);

  try {
    const survey = await getSurvey(input.surveyId);
    if (!survey) throw new ResourceNotFoundError("Survey", input.surveyId);

    const where = buildAnalysisWhere(survey, input.filter);
    const [included, lowQualityLeftOut] = await Promise.all([
      prisma.response.count({ where: where.included }),
      where.lowQualityLeftOut ? prisma.response.count({ where: where.lowQualityLeftOut }) : 0,
    ]);

    const builder = createAnalysisRowBuilder({
      survey,
      answers: input.answers ?? "codes",
      fields,
      isQuotasAllowed,
      timeZone: input.timeZone,
    });
    const collector = createUnmappedCollector();
    const select = buildAnalysisSelect(fields, isQuotasAllowed);
    const fileUploadIds = getSurveyFileUploadElementIds(survey);
    let rowCount = 0;

    async function* rows() {
      let cursor: TResponseCursor | undefined;
      while (true) {
        const batch = (await prisma.response.findMany({
          where: whereAfterResponseCursor(where.included, cursor),
          select,
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          take: batchSize,
        })) as unknown as TAnalysisSelected[];

        yield batch.map((row) => {
          const response = toAnalysisResponse(row);
          // File URLs resolve like the Standard export does, for the file upload answers only.
          for (const id of fileUploadIds) {
            if (response.data[id] !== undefined)
              response.data[id] = resolveStorageUrlsInObject(response.data[id]);
          }
          return builder.buildRow(response, collector.add);
        });
        rowCount += batch.length;

        const last = batch.at(-1);
        if (!last || batch.length < batchSize) return;
        cursor = { id: last.id, createdAt: last.createdAt };
      }
    }

    return {
      columns: builder.columns,
      counts: { included, lowQualityLeftOut },
      rows,
      summary: () => {
        const { unmapped, dropped } = collector.result();
        return { rowCount, unmapped, unmappedDropped: dropped };
      },
    };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) throw new DatabaseError(error.message);
    throw error;
  }
};
