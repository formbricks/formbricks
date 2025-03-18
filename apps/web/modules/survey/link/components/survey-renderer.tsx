import { getMultiLanguagePermission } from "@/modules/ee/license-check/lib/utils";
import { getOrganizationIdFromEnvironmentId } from "@/modules/survey/lib/organization";
import { getResponseCountBySurveyId } from "@/modules/survey/lib/response";
import { getOrganizationBilling } from "@/modules/survey/lib/survey";
import { LinkSurvey } from "@/modules/survey/link/components/link-survey";
import { PinScreen } from "@/modules/survey/link/components/pin-screen";
import { SurveyInactive } from "@/modules/survey/link/components/survey-inactive";
import { getEmailVerificationDetails } from "@/modules/survey/link/lib/helper";
import { getProjectByEnvironmentId } from "@/modules/survey/link/lib/project";
import { type Response } from "@prisma/client";
import { notFound } from "next/navigation";
import { IMPRINT_URL, IS_FORMBRICKS_CLOUD, PRIVACY_URL, WEBAPP_URL } from "@formbricks/lib/constants";
import { findMatchingLocale } from "@formbricks/lib/utils/locale";
import { TSurvey } from "@formbricks/types/surveys/types";

interface SurveyRendererProps {
  survey: TSurvey;
  searchParams: {
    verify?: string;
    lang?: string;
    embed?: string;
    preview?: string;
  };
  singleUseId?: string;
  singleUseResponse?: Pick<Response, "id" | "finished"> | undefined;
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
  const locale = await findMatchingLocale();
  const langParam = searchParams.lang;
  const isEmbed = searchParams.embed === "true";

  if (survey.status === "draft") {
    notFound();
  }

  const organizationId = await getOrganizationIdFromEnvironmentId(survey.environmentId);
  const organizationBilling = await getOrganizationBilling(organizationId);
  if (!organizationBilling) {
    throw new Error("Organization not found");
  }
  const isMultiLanguageAllowed = await getMultiLanguagePermission(organizationBilling.plan);

  if (survey.status !== "inProgress" && !isPreview) {
    return (
      <SurveyInactive
        status={survey.status}
        surveyClosedMessage={survey.surveyClosedMessage ? survey.surveyClosedMessage : undefined}
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

  // get project
  const project = await getProjectByEnvironmentId(survey.environmentId);
  if (!project) {
    throw new Error("Project not found");
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
  const responseCount = await getResponseCountBySurveyId(survey.id);

  if (isSurveyPinProtected) {
    return (
      <PinScreen
        surveyId={survey.id}
        project={project}
        emailVerificationStatus={emailVerificationStatus}
        singleUseId={singleUseId}
        singleUseResponse={singleUseResponse}
        webAppUrl={WEBAPP_URL}
        IMPRINT_URL={IMPRINT_URL}
        PRIVACY_URL={PRIVACY_URL}
        IS_FORMBRICKS_CLOUD={IS_FORMBRICKS_CLOUD}
        verifiedEmail={verifiedEmail}
        languageCode={languageCode}
        isEmbed={isEmbed}
        locale={locale}
        isPreview={isPreview}
      />
    );
  }

  return (
    <LinkSurvey
      survey={survey}
      project={project}
      emailVerificationStatus={emailVerificationStatus}
      singleUseId={singleUseId}
      singleUseResponse={singleUseResponse}
      webAppUrl={WEBAPP_URL}
      responseCount={survey.welcomeCard.showResponseCount ? responseCount : undefined}
      verifiedEmail={verifiedEmail}
      languageCode={languageCode}
      isEmbed={isEmbed}
      IMPRINT_URL={IMPRINT_URL}
      PRIVACY_URL={PRIVACY_URL}
      IS_FORMBRICKS_CLOUD={IS_FORMBRICKS_CLOUD}
      locale={locale}
      isPreview={isPreview}
      contactId={contactId}
    />
  );
};
