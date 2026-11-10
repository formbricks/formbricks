import type { TSurveySlugResource } from "@/app/api/internal/surveys/[surveyId]/slug/serializers";
import { sendApiRequest } from "@/modules/api/lib/internal-api-client";

const slugPath = (surveyId: string) => `/api/internal/surveys/${encodeURIComponent(surveyId)}/slug`;

/** Give the survey a pretty URL, `/p/{slug}`. Self-hosted instances only. */
export const updateSurveySlug = (surveyId: string, slug: string) =>
  sendApiRequest<TSurveySlugResource>(slugPath(surveyId), { method: "PUT", body: { slug } });

/** Remove the survey's pretty URL. */
export const removeSurveySlug = (surveyId: string) =>
  sendApiRequest<void>(slugPath(surveyId), { method: "DELETE" });
