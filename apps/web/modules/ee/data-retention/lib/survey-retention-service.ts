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
  const [responses, notice] = await Promise.all([
    prisma.response.aggregate({
      where: { surveyId },
      _min: { createdAt: true },
      _max: { createdAt: true },
    }),
    prisma.retentionNotice.findUnique({
      where: { surveyId_entity: { surveyId, entity: "surveys" } },
      select: { sentAt: true },
    }),
  ]);

  return {
    createdAt: survey.createdAt,
    updatedAt: survey.updatedAt,
    archivedAt: survey.archivedAt ?? null,
    oldestResponseAt: responses._min.createdAt,
    newestResponseAt: responses._max.createdAt,
    surveysNoticeSentAt: notice?.sentAt ?? null,
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
