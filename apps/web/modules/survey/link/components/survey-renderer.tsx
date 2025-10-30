import { type Response } from "@prisma/client";
import { notFound } from "next/navigation";
import { TSurvey } from "@formbricks/types/surveys/types";
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
import { LinkSurvey } from "@/modules/survey/link/components/link-survey";
import { PinScreen } from "@/modules/survey/link/components/pin-screen";
import { SurveyInactive } from "@/modules/survey/link/components/survey-inactive";
import { getEnvironmentContextForLinkSurvey } from "@/modules/survey/link/lib/environment";
import { getEmailVerificationDetails } from "@/modules/survey/link/lib/helper";

interface SurveyRendererProps {
  survey: TSurvey;
  searchParams: {
    verify?: string;
    lang?: string;
    embed?: string;
    preview?: string;
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

  // verify email: Check if the survey requires email verification
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

  const getLanguageCode = (): string => {
    if (!langParam || !isMultiLanguageAllowed) return "default";
    else {
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
  };

  const languageCode = getLanguageCode();
  const isSurveyPinProtected = Boolean(survey.pin);
  const publicDomain = getPublicDomain();

  if (isSurveyPinProtected) {
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

  return (
    <LinkSurvey
      survey={survey}
      project={project}
      publicDomain={publicDomain}
      emailVerificationStatus={emailVerificationStatus}
      singleUseId={singleUseId}
      singleUseResponse={singleUseResponse}
      responseCount={responseCount}
      verifiedEmail={verifiedEmail}
      languageCode={languageCode}
      isEmbed={isEmbed}
      IMPRINT_URL={IMPRINT_URL}
      PRIVACY_URL={PRIVACY_URL}
      IS_FORMBRICKS_CLOUD={IS_FORMBRICKS_CLOUD}
      locale={locale}
      isPreview={isPreview}
      contactId={contactId}
      recaptchaSiteKey={RECAPTCHA_SITE_KEY}
      isSpamProtectionEnabled={isSpamProtectionEnabled}
    />
  );
};
