export const revalidate = REVALIDATION_INTERVAL;

import LinkSurvey from "@/app/s/[surveyId]/LinkSurvey";
import SurveyInactive from "@/app/s/[surveyId]/SurveyInactive";
import { REVALIDATION_INTERVAL } from "@formbricks/lib/constants";
import { getOrCreatePersonByUserId } from "@formbricks/lib/services/person";
import { getProductByEnvironmentId } from "@formbricks/lib/services/product";
import { getSurvey } from "@formbricks/lib/services/survey";
import { getEmailVerificationStatus } from "./helpers";
import { checkValidity } from "@/app/s/[surveyId]/prefilling";
import { notFound } from "next/navigation";
import { getResponseBySingleUseId } from "@formbricks/lib/services/response";
import { TResponse } from "@formbricks/types/v1/responses";
import { validateSurveySingleUseId } from "@/lib/surveys/surveys";

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
    const validatedSingleUseId = validateSurveySingleUseId(suId);
    if (!validatedSingleUseId) {
      return <SurveyInactive status="link invalid" />;
    }
    singleUseId = validatedSingleUseId;
  }

  let singleUseResponse: TResponse | undefined = undefined;
  if (isSingleUseSurvey) {
    singleUseResponse = (await getResponseBySingleUseId(survey.id, singleUseId)) ?? undefined;
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

  return (
    <LinkSurvey
      survey={survey}
      product={product}
      personId={person?.id}
      emailVerificationStatus={emailVerificationStatus}
      prefillAnswer={isPrefilledAnswerValid ? prefillAnswer : null}
      singleUseId={isSingleUseSurvey ? singleUseId : undefined}
      singleUseResponse={singleUseResponse ? singleUseResponse : undefined}
    />
  );
}
