import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ZId } from "@formbricks/types/common";
import { findMatchingLocale, getAcceptedLanguages } from "@/lib/utils/locale";
import { getResponseCountBySurveyId } from "@/modules/survey/lib/response";
import { SurveyInactive } from "@/modules/survey/link/components/survey-inactive";
import { renderSurvey } from "@/modules/survey/link/components/survey-renderer";
import { getResponseBySingleUseId } from "@/modules/survey/link/lib/data";
import { getServableLinkSurvey } from "@/modules/survey/link/lib/servable-survey";
import { getLinkSurveySingleUseAccess } from "@/modules/survey/link/lib/single-use-link";
import type { TLinkSurveySearchParams } from "@/modules/survey/link/lib/types";
import { getWorkspaceContextForLinkSurvey } from "@/modules/survey/link/lib/workspace";
import { getMetadataForLinkSurvey } from "@/modules/survey/link/metadata";

interface LinkSurveyPageProps {
  params: Promise<{
    surveyId: string;
  }>;
  searchParams: Promise<TLinkSurveySearchParams>;
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

  return getMetadataForLinkSurvey({
    surveyId: params.surveyId,
    languageCode,
    acceptedLanguages: await getAcceptedLanguages(),
    suId: searchParams.suId,
    suToken: searchParams.suToken,
  });
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
   *
   * This reduces waterfall from 4-5 levels to 2 levels:
   * - Before: ~400-1500ms added latency for distant users
   * - After: ~200-600ms added latency for distant users
   * - Improvement: 50-60% latency reduction
   *
   * CACHING NOTE:
   * getSurveyWithMetadata is wrapped in React's cache(), so the call from
   * generateMetadata and this page component are automatically deduplicated.
   */

  // Stage 1: Fetch survey first (required for all subsequent logic). Only a survey this page may serve
  // comes back, so the single-use screen below can't confirm a non-public one exists (ENG-4032).
  const survey = await getServableLinkSurvey(params.surveyId);
  if (!survey) {
    return notFound();
  }

  // Validate the single-use link early (no I/O, just validation)
  const singleUse = getLinkSurveySingleUseAccess({
    survey,
    suId: searchParams.suId,
    suToken: searchParams.suToken,
    surface: "link_page",
  });
  if (!singleUse.allowed) {
    // Need to fetch workspace for error page - fetch environmentContext for it
    const environmentContext = await getWorkspaceContextForLinkSurvey(survey.workspaceId);
    return <SurveyInactive status="link invalid" workspace={environmentContext.workspace} />;
  }
  const { singleUseId } = singleUse;

  // Stage 2: Parallel fetch of all remaining data
  const [workspaceContext, locale, acceptedLanguages, singleUseResponse] = await Promise.all([
    getWorkspaceContextForLinkSurvey(survey.workspaceId),
    findMatchingLocale(),
    getAcceptedLanguages(),
    // Only fetch single-use response if we have a validated ID
    singleUseId ? getResponseBySingleUseId(survey.id, singleUseId)() : Promise.resolve(undefined),
  ]);

  const singleUseResponseSummary = singleUseResponse
    ? { id: singleUseResponse.id, finished: singleUseResponse.finished }
    : undefined;

  // Fetch responseCount only if needed (depends on survey config)
  const responseCount = survey.welcomeCard.showResponseCount
    ? await getResponseCountBySurveyId(survey.id)
    : undefined;

  // Pass all pre-fetched data to renderer
  return renderSurvey({
    survey,
    searchParams,
    singleUseId,
    singleUseResponse: singleUseResponseSummary,
    allowUrlUserIdLookup: true,
    isPreview,
    workspaceContext,
    locale,
    acceptedLanguages,
    responseCount,
  });
};
