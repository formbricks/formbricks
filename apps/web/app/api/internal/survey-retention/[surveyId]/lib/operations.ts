import "server-only";
import { prisma } from "@formbricks/database";
import { successResponse } from "@/app/api/v3/lib/response";
import type { TV3Authentication } from "@/app/api/v3/lib/types";
import { getAuthorizedV3Survey } from "@/app/api/v3/surveys/authorization";
import { readDatabaseClock } from "@/lib/utils/database-clock";
import { listActiveSurveyRetentionExemptions } from "@/modules/ee/data-retention/lib/exemptions-service";
import { getSurveyRetentionPlan } from "@/modules/ee/data-retention/lib/survey-retention";
import {
  countSurveyResponsesCreatedAtOrBefore,
  getSurveyRetentionFacts,
  getSurveyRetentionPolicies,
} from "@/modules/ee/data-retention/lib/survey-retention-service";
import { getIsDataRetentionEnabled } from "@/modules/ee/license-check/lib/utils";
import {
  SURVEY_RETENTION_NOT_GOVERNED,
  serializeSurveyRetention,
  serializeSurveyRetentionPolicy,
} from "../serializers";

/**
 * What data retention will do to one survey, for its summary note and settings card. Anyone who can
 * read the survey may ask, through the v3 survey check (workspace access and ENG-3282 visibility), so
 * an unknown survey and an invisible one are the same 403. An organisation without the entitlement
 * gets `governed: false` rather than a 403, so the survey pages need no error handling (ENG-3695).
 */
export async function getSurveyRetentionOperation({
  authentication,
  surveyId,
  requestId,
  instance,
}: {
  authentication: TV3Authentication;
  surveyId: string;
  requestId: string;
  instance: string;
}): Promise<Response> {
  const { survey, authResult, response } = await getAuthorizedV3Survey({
    surveyId,
    authentication,
    access: "read",
    requestId,
    instance,
  });
  if (response) return response;

  if (!(await getIsDataRetentionEnabled(authResult.organizationId))) {
    return successResponse(SURVEY_RETENTION_NOT_GOVERNED, { requestId, cache: "private, no-store" });
  }

  // The database's clock, which exemption ends and notices are stamped with (`readDatabaseClock`).
  const now = await readDatabaseClock(prisma);
  const [policies, facts, exemptions] = await Promise.all([
    getSurveyRetentionPolicies(authResult.organizationId),
    getSurveyRetentionFacts(survey, now),
    listActiveSurveyRetentionExemptions({ surveyId, organizationId: authResult.organizationId, now }),
  ]);

  const plans = getSurveyRetentionPlan({
    policies,
    survey: facts,
    exemptPolicies: new Set(exemptions.map((exemption) => exemption.entity)),
    now,
  });

  const serializedPolicies = await Promise.all(
    plans.map(async (plan) =>
      serializeSurveyRetentionPolicy(
        plan,
        plan.dueCreatedAtOrBefore
          ? await countSurveyResponsesCreatedAtOrBefore(surveyId, plan.dueCreatedAtOrBefore)
          : null
      )
    )
  );

  return successResponse(serializeSurveyRetention(serializedPolicies, exemptions), {
    requestId,
    cache: "private, no-store",
  });
}
