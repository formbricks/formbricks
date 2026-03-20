import { notFound } from "next/navigation";
import { getSurveySummary } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/lib/surveySummary";
import { DEFAULT_LOCALE } from "@/lib/constants";
import { checkRateLimit, getClientIpForRateLimit } from "@/lib/rate-limit";
import { getSurvey } from "@/lib/survey/service";
import { PublicSummaryPage } from "@/modules/survey-result-share-link/components/PublicSummaryPage";
import {
  stripPiiFromSummary,
  validateShareLink,
} from "@/modules/survey-result-share-link/lib/survey-result-share-link";

const ShareResultsPage = async (props: { params: Promise<{ token: string }> }) => {
  const params = await props.params;
  const { token } = params;

  // Rate limiting: 30 requests per minute per IP
  const clientIp = await getClientIpForRateLimit();
  const isAllowed = await checkRateLimit(`share-results:${clientIp}`, 30, 60_000);
  if (!isAllowed) {
    return notFound();
  }

  // Validate the share link (checks JWT signature, revocation, expiration)
  const validation = await validateShareLink(token);
  if (!validation) {
    return notFound();
  }

  // Fetch the survey
  const survey = await getSurvey(validation.surveyId);
  if (!survey) {
    return notFound();
  }

  // Fetch the summary data (no filters for public view)
  const rawSummary = await getSurveySummary(validation.surveyId);

  // Strip PII and quotas from the summary
  const surveySummary = stripPiiFromSummary(rawSummary);

  return <PublicSummaryPage survey={survey} surveySummary={surveySummary} locale={DEFAULT_LOCALE} />;
};

export default ShareResultsPage;
