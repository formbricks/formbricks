import { validateSurveySingleUseId } from "@/app/lib/singleUseSurveys";
import { getMultiLanguagePermission } from "@/modules/ee/license-check/lib/utils";
import { LinkSurvey } from "@/modules/survey/link-surveys/components/link-survey";
import { PinScreen } from "@/modules/survey/link-surveys/components/pin-screen";
import { SurveyInactive } from "@/modules/survey/link-surveys/components/survey-inactive";
import { getOrganizationBilling } from "@/modules/survey/link-surveys/lib/organization";
import { getProjectByEnvironmentId } from "@/modules/survey/link-surveys/lib/project";
import {
  getResponseBySingleUseId,
  getResponseCountBySurveyId,
} from "@/modules/survey/link-surveys/lib/response";
import { getSurvey } from "@/modules/survey/link-surveys/lib/survey";
import { getMetadataForLinkSurvey } from "@/modules/survey/link-surveys/metadata";
import { Response } from "@prisma/client";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { IMPRINT_URL, IS_FORMBRICKS_CLOUD, PRIVACY_URL, WEBAPP_URL } from "@formbricks/lib/constants";
import { findMatchingLocale } from "@formbricks/lib/utils/locale";
import { ZId } from "@formbricks/types/common";
import { getEmailVerificationDetails } from "./lib/utils";

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
  const survey = await getSurvey(params.surveyId);
  const locale = await findMatchingLocale();
  const suId = searchParams.suId;
  const langParam = searchParams.lang; //can either be language code or alias
  const isSingleUseSurvey = survey?.singleUse?.enabled;
  const isSingleUseSurveyEncrypted = survey?.singleUse?.isEncrypted;
  const isEmbed = searchParams.embed === "true";
  if (!survey || survey.type !== "link" || survey.status === "draft") {
    notFound();
  }

  const organizationBilling = await getOrganizationBilling(survey.environmentId);
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

  let singleUseResponse: Pick<Response, "id" | "finished"> | undefined = undefined;
  if (isSingleUseSurvey) {
    try {
      singleUseResponse = singleUseId
        ? ((await getResponseBySingleUseId(survey.id, singleUseId)) ?? undefined)
        : undefined;
    } catch (error) {
      singleUseResponse = undefined;
    }
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

  // get project and person
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
      if (selectedLanguage?.default || !selectedLanguage?.enabled) {
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
        singleUseId={isSingleUseSurvey ? singleUseId : undefined}
        singleUseResponse={singleUseResponse ? singleUseResponse : undefined}
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
      singleUseId={isSingleUseSurvey ? singleUseId : undefined}
      singleUseResponse={singleUseResponse ? singleUseResponse : undefined}
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
    />
  );
};
