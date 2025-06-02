import { validateSurveySingleUseId } from "@/app/lib/singleUseSurveys";
import { SurveyInactive } from "@/modules/survey/link/components/survey-inactive";
import { renderSurvey } from "@/modules/survey/link/components/survey-renderer";
import { getResponseBySingleUseId, getSurveyWithMetadata } from "@/modules/survey/link/lib/data";
import { getMetadataForLinkSurvey } from "@/modules/survey/link/metadata";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ZId } from "@formbricks/types/common";

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
  const validId = ZId.safeParse(params.surveyId);
  if (!validId.success) {
    notFound();
  }

  return getMetadataForLinkSurvey(params.surveyId);
};

export const LinkSurveyPage = async (props: LinkSurveyPageProps) => {
  const searchParams = await props.searchParams;
  const params = await props.params;
  const validId = ZId.safeParse(params.surveyId);
  if (!validId.success) {
    notFound();
  }

  const isPreview = searchParams.preview === "true";

  // Use optimized survey data fetcher (includes all necessary data)
  const survey = await getSurveyWithMetadata(params.surveyId);
  const suId = searchParams.suId;

  const isSingleUseSurvey = survey?.singleUse?.enabled;
  const isSingleUseSurveyEncrypted = survey?.singleUse?.isEncrypted;

  let singleUseId: string | undefined = undefined;

  if (isSingleUseSurvey) {
    // check if the single use id is present for single use surveys
    if (!suId) {
      return <SurveyInactive status="link invalid" />;
    }

    // if encryption is enabled, validate the single use id
    let validatedSingleUseId: string | undefined = undefined;
    if (isSingleUseSurveyEncrypted) {
      validatedSingleUseId = validateSurveySingleUseId(suId);
      if (!validatedSingleUseId) {
        return <SurveyInactive status="link invalid" />;
      }
    }
    // if encryption is disabled, use the suId as is
    singleUseId = validatedSingleUseId ?? suId;
  }

  let singleUseResponse;
  if (isSingleUseSurvey && singleUseId) {
    try {
      // Use optimized response fetcher with proper caching
      const fetchResponseFn = getResponseBySingleUseId(survey.id, singleUseId);
      singleUseResponse = await fetchResponseFn();
    } catch (error) {
      console.error(error); // It's good practice to log the error
      singleUseResponse = undefined;
    }
  }

  return renderSurvey({
    survey,
    searchParams,
    singleUseId,
    singleUseResponse,
    isPreview,
  });
};
