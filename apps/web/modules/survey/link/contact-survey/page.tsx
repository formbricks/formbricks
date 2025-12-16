import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { findMatchingLocale } from "@/lib/utils/locale";
import { getTranslate } from "@/lingodotdev/server";
import { verifyContactSurveyToken } from "@/modules/ee/contacts/lib/contact-survey-link";
import { getMultiLanguagePermission } from "@/modules/ee/license-check/lib/utils";
import { getResponseCountBySurveyId } from "@/modules/survey/lib/response";
import { getSurvey } from "@/modules/survey/lib/survey";
import { SurveyInactive } from "@/modules/survey/link/components/survey-inactive";
import { renderSurvey } from "@/modules/survey/link/components/survey-renderer";
import { getExistingContactResponse } from "@/modules/survey/link/lib/data";
import { getEnvironmentContextForLinkSurvey } from "@/modules/survey/link/lib/environment";
import { checkAndValidateSingleUseId } from "@/modules/survey/link/lib/helper";
import { getBasicSurveyMetadata } from "@/modules/survey/link/lib/metadata-utils";
import { getProjectByEnvironmentId } from "@/modules/survey/link/lib/project";

interface ContactSurveyPageProps {
  params: Promise<{
    jwt: string;
  }>;
  searchParams: Promise<{
    suId?: string;
    verify?: string;
    lang?: string;
    embed?: string;
    preview?: string;
  }>;
}

export const generateMetadata = async (props: ContactSurveyPageProps): Promise<Metadata> => {
  const { jwt } = await props.params;
  try {
    // Verify and decode the JWT token
    const result = verifyContactSurveyToken(jwt);
    if (!result.ok) {
      return {
        title: "Survey",
        description: "Please complete this survey.",
      };
    }
    const { surveyId } = result.data;
    return getBasicSurveyMetadata(surveyId);
  } catch (error) {
    // If the token is invalid, we'll return generic metadata
    return {
      title: "Survey",
      description: "Please complete this survey.",
    };
  }
};

export const ContactSurveyPage = async (props: ContactSurveyPageProps) => {
  const searchParams = await props.searchParams;
  const params = await props.params;

  const t = await getTranslate();
  const { jwt } = params;
  const { preview, suId } = searchParams;

  const result = verifyContactSurveyToken(jwt);
  if (!result.ok) {
    if (
      result.error.type === "bad_request" &&
      result.error.details?.some((detail) => detail.issue === "token_expired")
    ) {
      return <SurveyInactive surveyClosedMessage={{ heading: t("c.link_expired") }} status="link expired" />;
    }
    // When token is invalid, we don't have survey data to get project branding settings
    // So we show SurveyInactive without project data (shows branding by default for backward compatibility)
    return <SurveyInactive status="link invalid" />;
  }

  const { surveyId, contactId } = result.data;

  const existingResponse = await getExistingContactResponse(surveyId, contactId)();
  if (existingResponse) {
    const survey = await getSurvey(surveyId);
    if (survey) {
      const project = await getProjectByEnvironmentId(survey.environmentId);
      return <SurveyInactive status="response submitted" project={project || undefined} />;
    }
    return <SurveyInactive status="response submitted" />;
  }

  const isPreview = preview === "true";
  const survey = await getSurvey(surveyId);

  if (!survey) {
    notFound();
  }

  const isSingleUseSurvey = survey?.singleUse?.enabled;
  const isSingleUseSurveyEncrypted = survey?.singleUse?.isEncrypted;

  let singleUseId: string | undefined = undefined;

  if (isSingleUseSurvey) {
    const validatedSingleUseId = checkAndValidateSingleUseId(suId, isSingleUseSurveyEncrypted);
    if (!validatedSingleUseId) {
      const environmentContext = await getEnvironmentContextForLinkSurvey(survey.environmentId);
      return <SurveyInactive status="link invalid" project={environmentContext.project} />;
    }

    singleUseId = validatedSingleUseId;
  }

  // Parallel fetch of environment context and locale
  const [environmentContext, locale, singleUseResponse] = await Promise.all([
    getEnvironmentContextForLinkSurvey(survey.environmentId),
    findMatchingLocale(),
    // Fetch existing response for this contact
    getExistingContactResponse(survey.id, contactId)(),
  ]);

  // Get multi-language permission
  const isMultiLanguageAllowed = await getMultiLanguagePermission(
    environmentContext.organizationBilling.plan
  );

  // Fetch responseCount only if needed
  const responseCount = survey.welcomeCard.showResponseCount
    ? await getResponseCountBySurveyId(survey.id)
    : undefined;

  return renderSurvey({
    survey,
    searchParams,
    contactId,
    isPreview,
    singleUseId,
    singleUseResponse,
    environmentContext,
    locale,
    isMultiLanguageAllowed,
    responseCount,
  });
};
