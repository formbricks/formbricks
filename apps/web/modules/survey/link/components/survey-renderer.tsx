import { type Response } from "@prisma/client";
import { notFound } from "next/navigation";
import { TProjectStyling } from "@formbricks/types/project";
import { TSurvey, TSurveyStyling } from "@formbricks/types/surveys/types";
import {
  IMPRINT_URL,
  IS_FORMBRICKS_CLOUD,
  IS_RECAPTCHA_CONFIGURED,
  PRIVACY_URL,
  RECAPTCHA_SITE_KEY,
} from "@/lib/constants";
import { getPublicDomain } from "@/lib/getPublicUrl";
import { findMatchingLocale } from "@/lib/utils/locale";
import { getMultiLanguagePermission } from "@/modules/ee/license-check/lib/utils";
import { getResponseCountBySurveyId } from "@/modules/survey/lib/response";
import { PinScreen } from "@/modules/survey/link/components/pin-screen";
import { SurveyClientWrapper } from "@/modules/survey/link/components/survey-client-wrapper";
import { SurveyCompletedMessage } from "@/modules/survey/link/components/survey-completed-message";
import { SurveyInactive } from "@/modules/survey/link/components/survey-inactive";
import { VerifyEmail } from "@/modules/survey/link/components/verify-email";
import { getEnvironmentContextForLinkSurvey } from "@/modules/survey/link/lib/environment";
import { getEmailVerificationDetails } from "@/modules/survey/link/lib/helper";

interface SurveyRendererProps {
  survey: TSurvey;
  searchParams: {
    verify?: string;
    lang?: string;
    embed?: string;
    preview?: string;
    suId?: string;
  };
  singleUseId?: string;
  singleUseResponse?: Pick<Response, "id" | "finished">;
  contactId?: string;
  isPreview: boolean;
}

export const renderSurvey = async ({
  survey,
  searchParams,
  singleUseId,
  singleUseResponse,
  contactId,
  isPreview,
}: SurveyRendererProps) => {
  const langParam = searchParams.lang;
  const isEmbed = searchParams.embed === "true";

  if (survey.status === "draft" || survey.type !== "link") {
    notFound();
  }

  const { project, organizationBilling } = await getEnvironmentContextForLinkSurvey(survey.environmentId);

  const [locale, isMultiLanguageAllowed, responseCount] = await Promise.all([
    findMatchingLocale(),
    getMultiLanguagePermission(organizationBilling.plan),
    survey.welcomeCard.showResponseCount ? getResponseCountBySurveyId(survey.id) : Promise.resolve(undefined),
  ]);

  const isSpamProtectionEnabled = Boolean(IS_RECAPTCHA_CONFIGURED && survey.recaptcha?.enabled);

  if (survey.status !== "inProgress") {
    return (
      <SurveyInactive
        status={survey.status}
        surveyClosedMessage={survey.surveyClosedMessage}
        project={project}
      />
    );
  }

  // Check if single-use survey has already been completed
  if (singleUseResponse?.finished) {
    return <SurveyCompletedMessage singleUseMessage={survey.singleUse} project={project} />;
  }

  // Handle email verification flow if enabled
  let emailVerificationStatus = "";
  let verifiedEmail: string | undefined = undefined;

  if (survey.isVerifyEmailEnabled) {
    const token = searchParams.verify;

    if (token) {
      const emailVerificationDetails = await getEmailVerificationDetails(survey.id, token);
      emailVerificationStatus = emailVerificationDetails.status;
      verifiedEmail = emailVerificationDetails.email;
    }
  }

  if (survey.isVerifyEmailEnabled && emailVerificationStatus !== "verified" && !isPreview) {
    if (emailVerificationStatus === "fishy") {
      return (
        <VerifyEmail
          survey={survey}
          isErrorComponent={true}
          languageCode={getLanguageCode(langParam, isMultiLanguageAllowed, survey)}
          styling={project.styling}
          locale={locale}
        />
      );
    }
    return (
      <VerifyEmail
        singleUseId={searchParams.suId ?? ""}
        survey={survey}
        languageCode={getLanguageCode(langParam, isMultiLanguageAllowed, survey)}
        styling={project.styling}
        locale={locale}
      />
    );
  }

  // Compute final styling based on project and survey settings
  const styling = computeStyling(project.styling, survey.styling);
  const languageCode = getLanguageCode(langParam, isMultiLanguageAllowed, survey);
  const publicDomain = getPublicDomain();

  // Handle PIN-protected surveys
  if (survey.pin) {
    return (
      <PinScreen
        surveyId={survey.id}
        publicDomain={publicDomain}
        project={project}
        emailVerificationStatus={emailVerificationStatus}
        singleUseId={singleUseId}
        singleUseResponse={singleUseResponse}
        IMPRINT_URL={IMPRINT_URL}
        PRIVACY_URL={PRIVACY_URL}
        IS_FORMBRICKS_CLOUD={IS_FORMBRICKS_CLOUD}
        verifiedEmail={verifiedEmail}
        languageCode={languageCode}
        isEmbed={isEmbed}
        locale={locale}
        isPreview={isPreview}
        contactId={contactId}
        recaptchaSiteKey={RECAPTCHA_SITE_KEY}
        isSpamProtectionEnabled={isSpamProtectionEnabled}
      />
    );
  }

  // Render interactive survey with client component for interactivity
  return (
    <SurveyClientWrapper
      survey={survey}
      project={project}
      styling={styling}
      publicDomain={publicDomain}
      responseCount={responseCount}
      languageCode={languageCode}
      isEmbed={isEmbed}
      singleUseId={singleUseId}
      singleUseResponseId={singleUseResponse?.id}
      contactId={contactId}
      recaptchaSiteKey={RECAPTCHA_SITE_KEY}
      isSpamProtectionEnabled={isSpamProtectionEnabled}
      isPreview={isPreview}
      verifiedEmail={verifiedEmail}
      IMPRINT_URL={IMPRINT_URL}
      PRIVACY_URL={PRIVACY_URL}
      IS_FORMBRICKS_CLOUD={IS_FORMBRICKS_CLOUD}
    />
  );
};

/**
 * Determines which styling to use based on project and survey settings.
 * Returns survey styling if theme overwriting is enabled, otherwise returns project styling.
 */
function computeStyling(
  projectStyling: TProjectStyling,
  surveyStyling?: TSurveyStyling | null
): TProjectStyling | TSurveyStyling {
  if (!projectStyling.allowStyleOverwrite) {
    return projectStyling;
  }
  return surveyStyling?.overwriteThemeStyling ? surveyStyling : projectStyling;
}

/**
 * Determines the language code to use for the survey.
 * Checks URL parameter against available survey languages and returns
 * "default" if multi-language is not allowed or language is not found.
 */
function getLanguageCode(
  langParam: string | undefined,
  isMultiLanguageAllowed: boolean,
  survey: TSurvey
): string {
  if (!langParam || !isMultiLanguageAllowed) return "default";

  const selectedLanguage = survey.languages.find((surveyLanguage) => {
    return (
      surveyLanguage.language.code === langParam.toLowerCase() ||
      surveyLanguage.language.alias?.toLowerCase() === langParam.toLowerCase()
    );
  });

  if (!selectedLanguage || selectedLanguage?.default || !selectedLanguage?.enabled) {
    return "default";
  }
  return selectedLanguage.language.code;
}
