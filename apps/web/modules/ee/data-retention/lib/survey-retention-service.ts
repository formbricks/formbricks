import "server-only";
import { prisma } from "@formbricks/database";
import type { Prisma } from "@formbricks/database/prisma";
import type { TRetentionExemptionPolicy } from "../types";
import { getRetentionPolicyRows, resolveRetentionPolicySettings } from "./policies-service";
import type { TSurveyRetentionFacts, TSurveyRetentionPolicyInput } from "./survey-retention";

/** The two policies that act on surveys, with when each took effect. */
export async function getSurveyRetentionPolicies(
  organizationId: string
): Promise<Record<TRetentionExemptionPolicy, TSurveyRetentionPolicyInput>> {
  const rows = await getRetentionPolicyRows(organizationId);
  const settings = resolveRetentionPolicySettings(rows);
  const enabledAt = (policy: TRetentionExemptionPolicy) =>
    rows.find((row) => row.entity === policy)?.enabledAt ?? null;
  return {
    responses: { ...settings.responses, enabledAt: enabledAt("responses") },
    surveys: { ...settings.surveys, enabledAt: enabledAt("surveys") },
  };
}

/**
 * The facts a survey's retention dates derive from: its timestamps (from the survey the caller already
 * read), its oldest and newest response (one aggregate over `Response(surveyId, createdAt)`), and the
 * surveys-policy notice if one went out.
 */
export async function getSurveyRetentionFacts(survey: {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  /** Optional on the survey type; absent means never archived. */
  archivedAt?: Date | null;
}): Promise<TSurveyRetentionFacts> {
  const surveyId = survey.id;
  // Bound from the app clock, like every timestamp Prisma writes, rather than the session's `now()`.
  const now = new Date();
  const [responses, notices, heldUntil] = await Promise.all([
    prisma.response.aggregate({
      where: { surveyId },
      _min: { createdAt: true },
      _max: { createdAt: true },
    }),
    // Both of the survey's notices, by the unique (surveyId, entity) index.
    prisma.retentionNotice.findMany({
      where: { surveyId, entity: { in: ["surveys", "responses"] } },
      select: { entity: true, sentAt: true, deliveredAt: true },
    }),
    // When the survey's ended exemptions ended, per policy: a notice from before then is void.
    prisma.$queryRaw<{ entity: "surveys" | "responses"; endedAt: Date }[]>`
      SELECT "entity", MAX(LEAST("until", "revokedAt")) AS "endedAt"
      FROM "RetentionExemption"
      WHERE "surveyId" = ${surveyId} AND LEAST("until", "revokedAt") <= ${now}
      GROUP BY "entity"
    `,
  ]);
  const notice = (entity: "surveys" | "responses") => {
    const row = notices.find((candidate) => candidate.entity === entity);
    return row ? { claimedAt: row.sentAt, deliveredAt: row.deliveredAt } : null;
  };
  const endedAt = (entity: "surveys" | "responses") =>
    heldUntil.find((row) => row.entity === entity)?.endedAt ?? null;
  const latest = (a: Date | null, b: Date | null) => {
    if (!a || !b) return a ?? b;
    return a > b ? a : b;
  };

  return {
    createdAt: survey.createdAt,
    updatedAt: survey.updatedAt,
    archivedAt: survey.archivedAt ?? null,
    oldestResponseAt: responses._min.createdAt,
    newestResponseAt: responses._max.createdAt,
    surveysNotice: notice("surveys"),
    responsesNotice: notice("responses"),
    // Either kind of exemption holds the survey itself (ENG-3371).
    surveyHeldUntil: latest(endedAt("surveys"), endedAt("responses")),
    responsesHeldUntil: endedAt("responses"),
  };
}

/** A survey with more responses due than this is shown as "10,000+". */
export const SURVEY_RETENTION_DUE_COUNT_CAP = 10_000;

export type TCappedCount = { count: number; relation: "eq" | "gte" };

/**
 * How many of each survey's responses were created at or before `cutoff`, counting at most `cap` per
 * survey, so a survey with millions of responses costs no more than the cap. One statement for any
 * number of surveys, each walking `Response(surveyId, created_at)`.
 */
export async function countSurveysResponsesCreatedAtOrBefore(
  surveyIds: readonly string[],
  cutoff: Date,
  cap = SURVEY_RETENTION_DUE_COUNT_CAP,
  /** A bounded transaction, for the sweep; the shared client otherwise. */
  client: Pick<Prisma.TransactionClient, "$queryRaw"> = prisma
): Promise<Map<string, TCappedCount>> {
  if (surveyIds.length === 0) return new Map();
  const rows = await client.$queryRaw<{ surveyId: string; count: number }[]>`
    SELECT s."id" AS "surveyId",
           (SELECT count(*)::int FROM (
              SELECT 1 FROM "Response" r
              WHERE r."surveyId" = s."id" AND r."created_at" <= ${cutoff}
              LIMIT ${cap}
            ) AS capped) AS "count"
    FROM unnest(${[...surveyIds]}::text[]) AS s("id")
  `;
  return new Map(
    rows.map((row) => [row.surveyId, { count: row.count, relation: row.count >= cap ? "gte" : "eq" }])
  );
}

/** `countSurveysResponsesCreatedAtOrBefore` for one survey. */
export async function countSurveyResponsesCreatedAtOrBefore(
  surveyId: string,
  cutoff: Date,
  cap = SURVEY_RETENTION_DUE_COUNT_CAP
): Promise<TCappedCount> {
  return (
    (await countSurveysResponsesCreatedAtOrBefore([surveyId], cutoff, cap)).get(surveyId) ?? {
      count: 0,
      relation: "eq",
    }
  );
}
