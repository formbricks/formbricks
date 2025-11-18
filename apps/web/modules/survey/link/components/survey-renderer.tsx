import { type Response } from "@prisma/client";
import { notFound } from "next/navigation";
import { TProjectStyling } from "@formbricks/types/project";
import { TSurvey, TSurveyStyling } from "@formbricks/types/surveys/types";
import { TUserLocale } from "@formbricks/types/user";
import {
  IMPRINT_URL,
  IS_FORMBRICKS_CLOUD,
  IS_RECAPTCHA_CONFIGURED,
  PRIVACY_URL,
  RECAPTCHA_SITE_KEY,
} from "@/lib/constants";
import { getPublicDomain } from "@/lib/getPublicUrl";
import { PinScreen } from "@/modules/survey/link/components/pin-screen";
import { SurveyClientWrapper } from "@/modules/survey/link/components/survey-client-wrapper";
import { SurveyCompletedMessage } from "@/modules/survey/link/components/survey-completed-message";
import { SurveyInactive } from "@/modules/survey/link/components/survey-inactive";
import { VerifyEmail } from "@/modules/survey/link/components/verify-email";
import { TEnvironmentContextForLinkSurvey } from "@/modules/survey/link/lib/environment";
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
  // New props - pre-fetched in parent
  environmentContext: TEnvironmentContextForLinkSurvey;
  locale: TUserLocale;
  isMultiLanguageAllowed: boolean;
  responseCount?: number;
}

/**
 * Renders link survey with pre-fetched data from parent.
 *
 * This function receives all necessary data as props to avoid additional
 * database queries. The parent (page.tsx) fetches data in parallel stages
 * to minimize latency for users geographically distant from servers.
 *
 * @param environmentContext - Pre-fetched project and organization data
 * @param locale - User's locale from Accept-Language header
 * @param isMultiLanguageAllowed - Calculated from organization billing plan
 * @param responseCount - Conditionally fetched if showResponseCount is enabled
 */
export const renderSurvey = async ({
  survey,
  searchParams,
  singleUseId,
  singleUseResponse,
  contactId,
  isPreview,
  environmentContext,
  locale,
  isMultiLanguageAllowed,
  responseCount,
}: SurveyRendererProps) => {
  const langParam = searchParams.lang;
  const isEmbed = searchParams.embed === "true";

  if (survey.status === "draft" || survey.type !== "link") {
    notFound();
  }

  // Extract project from pre-fetched context
  const { project } = environmentContext;

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
        styling={styling}
        publicDomain={publicDomain}
        project={project}
        singleUseId={singleUseId}
        singleUseResponse={singleUseResponse}
        IMPRINT_URL={IMPRINT_URL}
        PRIVACY_URL={PRIVACY_URL}
        IS_FORMBRICKS_CLOUD={IS_FORMBRICKS_CLOUD}
        verifiedEmail={verifiedEmail}
        languageCode={languageCode}
        isEmbed={isEmbed}
        isPreview={isPreview}
        contactId={contactId}
        recaptchaSiteKey={RECAPTCHA_SITE_KEY}
        isSpamProtectionEnabled={isSpamProtectionEnabled}
        responseCount={responseCount}
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
