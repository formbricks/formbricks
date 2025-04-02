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
import { getSurveyDomain } from "@formbricks/lib/getSurveyUrl";
import { TSurvey } from "@formbricks/types/surveys/types";

interface SurveyRendererProps {
  survey: TSurvey;
  searchParams: {
    verify?: string;
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
  const isEmbed = searchParams.embed === "true";

  if (survey.status === "draft" || survey.type !== "link") {
    notFound();
  }

  const organizationId = await getOrganizationIdFromEnvironmentId(survey.environmentId);
  const organizationBilling = await getOrganizationBilling(organizationId);
  if (!organizationBilling) {
    throw new Error("Organization not found");
  }

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
    return "default";
  };

  const languageCode = getLanguageCode();
  const isSurveyPinProtected = Boolean(survey.pin);
  const responseCount = await getResponseCountBySurveyId(survey.id);
  const surveyDomain = getSurveyDomain();

  if (isSurveyPinProtected) {
    return (
      <PinScreen
        surveyId={survey.id}
        surveyDomain={surveyDomain}
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
        isPreview={isPreview}
        contactId={contactId}
      />
    );
  }

  return (
    <LinkSurvey
      survey={survey}
      project={project}
      surveyDomain={surveyDomain}
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
      isPreview={isPreview}
      contactId={contactId}
    />
  );
};
