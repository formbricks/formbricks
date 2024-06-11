import { validateSurveySingleUseId } from "@/app/lib/singleUseSurveys";
import { LinkSurvey } from "@/app/s/[surveyId]/components/LinkSurvey";
import { PinScreen } from "@/app/s/[surveyId]/components/PinScreen";
import { SurveyInactive } from "@/app/s/[surveyId]/components/SurveyInactive";
import { getMetadataForLinkSurvey } from "@/app/s/[surveyId]/metadata";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getMultiLanguagePermission } from "@formbricks/ee/lib/service";
import { getAttributeClasses } from "@formbricks/lib/attributeClass/service";
import { IMPRINT_URL, IS_FORMBRICKS_CLOUD, PRIVACY_URL, WEBAPP_URL } from "@formbricks/lib/constants";
import { getOrganizationByEnvironmentId } from "@formbricks/lib/organization/service";
import { createPerson, getPersonByUserId } from "@formbricks/lib/person/service";
import { getProductByEnvironmentId } from "@formbricks/lib/product/service";
import { getResponseBySingleUseId, getResponseCountBySurveyId } from "@formbricks/lib/response/service";
import { getSurvey } from "@formbricks/lib/survey/service";
import { ZId } from "@formbricks/types/environment";
import { TResponse } from "@formbricks/types/responses";

import { getEmailVerificationDetails } from "./lib/helpers";

interface LinkSurveyPageProps {
  params: {
    surveyId: string;
  };
  searchParams: {
    suId?: string;
    userId?: string;
    verify?: string;
    lang?: string;
    embed?: string;
  };
}

export const generateMetadata = async ({ params }: LinkSurveyPageProps): Promise<Metadata> => {
  const validId = ZId.safeParse(params.surveyId);
  if (!validId.success) {
    notFound();
  }

  return getMetadataForLinkSurvey(params.surveyId);
};

const Page = async ({ params, searchParams }: LinkSurveyPageProps) => {
  const validId = ZId.safeParse(params.surveyId);
  if (!validId.success) {
    notFound();
  }
  const survey = await getSurvey(params.surveyId);

  const suId = searchParams.suId;
  const langParam = searchParams.lang; //can either be language code or alias
  const isSingleUseSurvey = survey?.singleUse?.enabled;
  const isSingleUseSurveyEncrypted = survey?.singleUse?.isEncrypted;
  const isEmbed = searchParams.embed === "true" ? true : false;

  if (!survey || survey.type !== "link" || survey.status === "draft") {
    notFound();
  }

  const organization = await getOrganizationByEnvironmentId(survey?.environmentId);
  if (!organization) {
    throw new Error("Organization not found");
  }
  const isMultiLanguageAllowed = await getMultiLanguagePermission(organization);

  if (survey && survey.status !== "inProgress") {
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
        ? (await getResponseBySingleUseId(survey.id, singleUseId)) ?? undefined
        : undefined;
    } catch (error) {
      singleUseResponse = undefined;
    }
  }

  // verify email: Check if the survey requires email verification
  let emailVerificationStatus: string = "";
  let verifiedEmail: string | undefined = undefined;

  if (survey.verifyEmail) {
    const token =
      searchParams && Object.keys(searchParams).length !== 0 && searchParams.hasOwnProperty("verify")
        ? searchParams.verify
        : undefined;

    if (token) {
      const emailVerificationDetails = await getEmailVerificationDetails(survey.id, token);
      emailVerificationStatus = emailVerificationDetails.status;
      verifiedEmail = emailVerificationDetails.email;
    }
  }

  // get product and person
  const product = await getProductByEnvironmentId(survey.environmentId);
  if (!product) {
    throw new Error("Product not found");
  }

  const attributeClasses = await getAttributeClasses(survey.environmentId);

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
      return selectedLanguage ? selectedLanguage.language.code : "default";
    }
  };

  const languageCode = getLanguageCode();

  const userId = searchParams.userId;
  if (userId) {
    // make sure the person exists or get's created
    const person = await getPersonByUserId(survey.environmentId, userId);
    if (!person) {
      await createPerson(survey.environmentId, userId);
    }
  }

  const isSurveyPinProtected = Boolean(!!survey && survey.pin);
  const responseCount = await getResponseCountBySurveyId(survey.id);

  if (isSurveyPinProtected) {
    return (
      <PinScreen
        surveyId={survey.id}
        product={product}
        userId={userId}
        emailVerificationStatus={emailVerificationStatus}
        singleUseId={isSingleUseSurvey ? singleUseId : undefined}
        singleUseResponse={singleUseResponse ? singleUseResponse : undefined}
        webAppUrl={WEBAPP_URL}
        IMPRINT_URL={IMPRINT_URL}
        PRIVACY_URL={PRIVACY_URL}
        IS_FORMBRICKS_CLOUD={IS_FORMBRICKS_CLOUD}
        verifiedEmail={verifiedEmail}
        languageCode={languageCode}
        attributeClasses={attributeClasses}
        isEmbed={isEmbed}
      />
    );
  }

  return survey ? (
    <LinkSurvey
      survey={survey}
      product={product}
      userId={userId}
      emailVerificationStatus={emailVerificationStatus}
      singleUseId={isSingleUseSurvey ? singleUseId : undefined}
      singleUseResponse={singleUseResponse ? singleUseResponse : undefined}
      webAppUrl={WEBAPP_URL}
      responseCount={survey.welcomeCard.showResponseCount ? responseCount : undefined}
      verifiedEmail={verifiedEmail}
      languageCode={languageCode}
      attributeClasses={attributeClasses}
      isEmbed={isEmbed}
      IMPRINT_URL={IMPRINT_URL}
      PRIVACY_URL={PRIVACY_URL}
      IS_FORMBRICKS_CLOUD={IS_FORMBRICKS_CLOUD}
    />
  ) : null;
};

export default Page;
