import type { TSurveySlugResource } from "@/app/api/internal/surveys/[surveyId]/slug/serializers";
import { sendApiRequest } from "@/modules/api/lib/internal-api-client";
import { type TJsonUpdatedAt, reviveUpdatedAt } from "@/modules/api/lib/json-timestamps";

const slugPath = (surveyId: string) => `/api/internal/surveys/${encodeURIComponent(surveyId)}/slug`;

/** Give the survey a pretty URL, `/p/{slug}`. Self-hosted instances only. */
export const updateSurveySlug = async (surveyId: string, slug: string): Promise<TSurveySlugResource> =>
  reviveUpdatedAt(
    await sendApiRequest<TJsonUpdatedAt<TSurveySlugResource>>(slugPath(surveyId), {
      method: "PUT",
      body: { slug },
    })
  );

/** Remove the survey's pretty URL. */
export const removeSurveySlug = async (surveyId: string): Promise<TSurveySlugResource> =>
  reviveUpdatedAt(
    await sendApiRequest<TJsonUpdatedAt<TSurveySlugResource>>(slugPath(surveyId), { method: "DELETE" })
  );
