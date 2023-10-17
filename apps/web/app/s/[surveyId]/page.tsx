export const revalidate = REVALIDATION_INTERVAL;

import LinkSurvey from "@/app/s/[surveyId]/components/LinkSurvey";
import SurveyInactive from "@/app/s/[surveyId]/components/SurveyInactive";
import { REVALIDATION_INTERVAL, WEBAPP_URL } from "@formbricks/lib/constants";
import { getOrCreatePersonByUserId } from "@formbricks/lib/person/service";
import { getProductByEnvironmentId } from "@formbricks/lib/product/service";
import { getSurvey } from "@formbricks/lib/survey/service";
import { getEmailVerificationStatus } from "./lib/helpers";
import { checkValidity } from "@/app/s/[surveyId]/lib/prefilling";
import { notFound } from "next/navigation";
import { getResponseBySingleUseId } from "@formbricks/lib/response/service";
import { TResponse } from "@formbricks/types/v1/responses";
import { validateSurveySingleUseId } from "@/app/lib/singleUseSurveys";
import PinScreen from "@/app/s/[surveyId]/components/PinScreen";

interface LinkSurveyPageProps {
  params: {
    surveyId: string;
  };
  searchParams: {
    suId?: string;
    userId?: string;
    verify?: string;
  };
}

export default async function LinkSurveyPage({ params, searchParams }: LinkSurveyPageProps) {
  const survey = await getSurvey(params.surveyId);
  const suId = searchParams.suId;
  const isSingleUseSurvey = survey?.singleUse?.enabled;
  const isSingleUseSurveyEncrypted = survey?.singleUse?.isEncrypted;

  if (!survey || survey.type !== "link" || survey.status === "draft") {
    notFound();
  }

  // question pre filling: Check if the first question is prefilled and if it is valid
  const prefillAnswer = searchParams[survey.questions[0].id];
  const isPrefilledAnswerValid = prefillAnswer ? checkValidity(survey!.questions[0], prefillAnswer) : false;

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
  let emailVerificationStatus: string | undefined = undefined;
  if (survey.verifyEmail) {
    const token =
      searchParams && Object.keys(searchParams).length !== 0 && searchParams.hasOwnProperty("verify")
        ? searchParams.verify
        : undefined;

    if (token) {
      emailVerificationStatus = await getEmailVerificationStatus(survey.id, token);
    }
  }

  // get product and person
  const product = await getProductByEnvironmentId(survey.environmentId);
  if (!product) {
    throw new Error("Product not found");
  }

  const userId = searchParams.userId;
  let person;
  if (userId) {
    person = await getOrCreatePersonByUserId(userId, survey.environmentId);
  }

  const isSurveyPinProtected = Boolean(!!survey && survey.pin);

  if (isSurveyPinProtected) {
    return (
      <PinScreen
        surveyId={survey.id}
        product={product}
        personId={person?.id}
        emailVerificationStatus={emailVerificationStatus}
        prefillAnswer={isPrefilledAnswerValid ? prefillAnswer : null}
        singleUseId={isSingleUseSurvey ? singleUseId : undefined}
        singleUseResponse={singleUseResponse ? singleUseResponse : undefined}
        webAppUrl={WEBAPP_URL}
      />
    );
  }

  return (
    <LinkSurvey
      survey={survey}
      product={product}
      personId={person?.id}
      emailVerificationStatus={emailVerificationStatus}
      prefillAnswer={isPrefilledAnswerValid ? prefillAnswer : null}
      singleUseId={isSingleUseSurvey ? singleUseId : undefined}
      singleUseResponse={singleUseResponse ? singleUseResponse : undefined}
      webAppUrl={WEBAPP_URL}
    />
  );
}
