import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { logger } from "@formbricks/logger";
import { ZId } from "@formbricks/types/common";
import { TSurvey } from "@formbricks/types/surveys/types";
import { findMatchingLocale } from "@/lib/utils/locale";
import { getMultiLanguagePermission } from "@/modules/ee/license-check/lib/utils";
import { getResponseCountBySurveyId } from "@/modules/survey/lib/response";
import { SurveyInactive } from "@/modules/survey/link/components/survey-inactive";
import { renderSurvey } from "@/modules/survey/link/components/survey-renderer";
import { getResponseBySingleUseId, getSurveyWithMetadata } from "@/modules/survey/link/lib/data";
import { getEnvironmentContextForLinkSurvey } from "@/modules/survey/link/lib/environment";
import { checkAndValidateSingleUseId } from "@/modules/survey/link/lib/helper";
import { getMetadataForLinkSurvey } from "@/modules/survey/link/metadata";

interface LinkSurveyPageProps {
  params: Promise<{
    surveyId: string;
  }>;
  searchParams: Promise<{
    suId?: string;
    verify?: string;
    lang?: string;
    embed?: string;
    preview?: string;
  }>;
}

export const generateMetadata = async (props: LinkSurveyPageProps): Promise<Metadata> => {
  const params = await props.params;
  const searchParams = await props.searchParams;
  const validId = ZId.safeParse(params.surveyId);
  if (!validId.success) {
    notFound();
  }

  // Extract language code from URL params
  const languageCode = typeof searchParams.lang === "string" ? searchParams.lang : undefined;

  return getMetadataForLinkSurvey(params.surveyId, languageCode);
};

export const LinkSurveyPage = async (props: LinkSurveyPageProps) => {
  const searchParams = await props.searchParams;
  const params = await props.params;
  const validId = ZId.safeParse(params.surveyId);
  if (!validId.success) {
    notFound();
  }

  const isPreview = searchParams.preview === "true";

  /**
   * Optimized data fetching strategy for link surveys
   *
   * PERFORMANCE OPTIMIZATION:
   * We fetch data in carefully staged parallel operations to minimize latency.
   * Each sequential database call adds ~100-300ms for users far from servers.
   *
   * Fetch stages:
   * Stage 1: Survey (required first - provides config for all other fetches)
   * Stage 2: Parallel fetch of environment context, locale, and conditional single-use response
   * Stage 3: Multi-language permission (depends on billing from Stage 2)
   *
   * This reduces waterfall from 4-5 levels to 3 levels:
   * - Before: ~400-1500ms added latency for distant users
   * - After: ~200-600ms added latency for distant users
   * - Improvement: 50-60% latency reduction
   *
   * CACHING NOTE:
   * getSurveyWithMetadata is wrapped in React's cache(), so the call from
   * generateMetadata and this page component are automatically deduplicated.
   */

  // Stage 1: Fetch survey first (required for all subsequent logic)
  let survey: TSurvey | null = null;
  try {
    survey = await getSurveyWithMetadata(params.surveyId);
  } catch (error) {
    logger.error(error, "Error fetching survey");
    return notFound();
  }

  if (!survey) {
    return notFound();
  }

  const suId = searchParams.suId;

  // Validate single-use ID early (no I/O, just validation)
  const isSingleUseSurvey = survey.singleUse?.enabled;
  const isSingleUseSurveyEncrypted = survey.singleUse?.isEncrypted;
  let singleUseId: string | undefined = undefined;

  if (isSingleUseSurvey) {
    const validatedSingleUseId = checkAndValidateSingleUseId(suId, isSingleUseSurveyEncrypted);
    if (!validatedSingleUseId) {
      // Need to fetch project for error page - fetch environmentContext for it
      const environmentContext = await getEnvironmentContextForLinkSurvey(survey.environmentId);
      return <SurveyInactive status="link invalid" project={environmentContext.project} />;
    }
    singleUseId = validatedSingleUseId;
  }

  // Stage 2: Parallel fetch of all remaining data
  const [environmentContext, locale, singleUseResponse] = await Promise.all([
    getEnvironmentContextForLinkSurvey(survey.environmentId),
    findMatchingLocale(),
    // Only fetch single-use response if we have a validated ID
    isSingleUseSurvey && singleUseId
      ? getResponseBySingleUseId(survey.id, singleUseId)()
      : Promise.resolve(undefined),
  ]);

  // Stage 3: Get multi-language permission (depends on environmentContext)
  // Future optimization: Consider caching getMultiLanguagePermission by plan tier
  // since it's a pure computation based on billing plan. Could be memoized at
  // the plan level rather than per-request.
  const isMultiLanguageAllowed = await getMultiLanguagePermission(
    environmentContext.organizationBilling.plan
  );

  // Fetch responseCount only if needed (depends on survey config)
  const responseCount = survey.welcomeCard.showResponseCount
    ? await getResponseCountBySurveyId(survey.id)
    : undefined;

  // Pass all pre-fetched data to renderer
  return renderSurvey({
    survey,
    searchParams,
    singleUseId,
    singleUseResponse: singleUseResponse ?? undefined,
    isPreview,
    environmentContext,
    locale,
    isMultiLanguageAllowed,
    responseCount,
  });
};
