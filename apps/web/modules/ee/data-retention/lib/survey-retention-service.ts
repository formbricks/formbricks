import "server-only";
import { prisma } from "@formbricks/database";
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
      WHERE "surveyId" = ${surveyId} AND LEAST("until", "revokedAt") <= now()
      GROUP BY "entity"
    `,
  ]);
  const notice = (entity: "surveys" | "responses") => {
    const row = notices.find((candidate) => candidate.entity === entity);
    return row ? { claimedAt: row.sentAt, deliveredAt: row.deliveredAt } : null;
  };
  const endedAt = (entity: "surveys" | "responses") =>
    heldUntil.find((row) => row.entity === entity)?.endedAt ?? null;
  const latest = (a: Date | null, b: Date | null) => (a && b ? (a > b ? a : b) : (a ?? b));

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

/**
 * How many of a survey's responses were created at or before `cutoff`, counting at most `cap`, so a
 * survey with millions of responses costs no more than the cap. Walks `Response(surveyId, createdAt)`.
 */
export async function countSurveyResponsesCreatedAtOrBefore(
  surveyId: string,
  cutoff: Date,
  cap = SURVEY_RETENTION_DUE_COUNT_CAP
): Promise<{ count: number; relation: "eq" | "gte" }> {
  const [row] = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT count(*)::bigint AS count
    FROM (
      SELECT 1 FROM "Response" r
      WHERE r."surveyId" = ${surveyId} AND r."created_at" <= ${cutoff}
      LIMIT ${cap}
    ) AS capped
  `;
  const count = Number(row?.count ?? 0);
  return { count, relation: count >= cap ? "gte" : "eq" };
}
