import { validateSurveySingleUseId } from "@/app/lib/singleUseSurveys";
import { LinkSurvey } from "@/app/s/[surveyId]/components/link-survey";
import { PinScreen } from "@/app/s/[surveyId]/components/pin-screen";
import { SurveyInactive } from "@/app/s/[surveyId]/components/survey-inactive";
import { getMetadataForLinkSurvey } from "@/app/s/[surveyId]/metadata";
import { getMultiLanguagePermission } from "@/modules/ee/license-check/lib/utils";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { IMPRINT_URL, IS_FORMBRICKS_CLOUD, PRIVACY_URL, WEBAPP_URL } from "@formbricks/lib/constants";
import { getOrganizationByEnvironmentId } from "@formbricks/lib/organization/service";
import { getProjectByEnvironmentId } from "@formbricks/lib/project/service";
import { getResponseBySingleUseId, getResponseCountBySurveyId } from "@formbricks/lib/response/service";
import { getSurvey } from "@formbricks/lib/survey/service";
import { findMatchingLocale } from "@formbricks/lib/utils/locale";
import { ZId } from "@formbricks/types/common";
import { TResponse } from "@formbricks/types/responses";
import { getContactAttributeKeys } from "./lib/contact-attribute-key";
import { getEmailVerificationDetails } from "./lib/helpers";

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

const Page = async (props: LinkSurveyPageProps) => {
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

  const organization = await getOrganizationByEnvironmentId(survey.environmentId);
  if (!organization) {
    throw new Error("Organization not found");
  }
  const isMultiLanguageAllowed = await getMultiLanguagePermission(organization);

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

  let singleUseResponse: TResponse | undefined = undefined;
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

  const contactAttributeKeys = await getContactAttributeKeys(survey.environmentId);

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
        contactAttributeKeys={contactAttributeKeys}
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
      contactAttributeKeys={contactAttributeKeys}
      isEmbed={isEmbed}
      IMPRINT_URL={IMPRINT_URL}
      PRIVACY_URL={PRIVACY_URL}
      IS_FORMBRICKS_CLOUD={IS_FORMBRICKS_CLOUD}
      locale={locale}
      isPreview={isPreview}
    />
  );
};

export default Page;
