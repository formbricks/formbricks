"use client";

import ContentWrapper from "@formbricks/ui/ContentWrapper";
import { SurveyInline } from "@formbricks/ui/Survey";
import SurveyLinkUsed from "@/app/s/[surveyId]/components/SurveyLinkUsed";
import VerifyEmail from "@/app/s/[surveyId]/components/VerifyEmail";
import { getPrefillResponseData } from "@/app/s/[surveyId]/lib/prefilling";
import { ResponseQueue } from "@formbricks/lib/responseQueue";
import { SurveyState } from "@formbricks/lib/surveyState";
import { TProduct } from "@formbricks/types/product";
import { TResponse, TResponseData, TResponseUpdate } from "@formbricks/types/responses";
import { TSurvey } from "@formbricks/types/surveys";
import { ArrowPathIcon } from "@heroicons/react/24/solid";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { FormbricksAPI } from "@formbricks/api";

interface LinkSurveyProps {
  survey: TSurvey;
  product: TProduct;
  personId?: string;
  emailVerificationStatus?: string;
  prefillAnswer?: string;
  singleUseId?: string;
  singleUseResponse?: TResponse;
  webAppUrl: string;
}

export default function LinkSurvey({
  survey,
  product,
  personId,
  emailVerificationStatus,
  prefillAnswer,
  singleUseId,
  singleUseResponse,
  webAppUrl,
}: LinkSurveyProps) {
  const responseId = singleUseResponse?.id;
  const searchParams = useSearchParams();
  const isPreview = searchParams?.get("preview") === "true";
  const sourceParam = searchParams?.get("source");
  // pass in the responseId if the survey is a single use survey, ensures survey state is updated with the responseId
  const [surveyState, setSurveyState] = useState(
    new SurveyState(survey.id, singleUseId, responseId, personId)
  );
  const [activeQuestionId, setActiveQuestionId] = useState<string>(
    survey.welcomeCard.enabled ? "start" : survey?.questions[0]?.id
  );
  const prefillResponseData: TResponseData | undefined = prefillAnswer
    ? getPrefillResponseData(survey.questions[0], survey, prefillAnswer)
    : undefined;

  const brandColor = survey.productOverwrites?.brandColor || product.brandColor;

  const responseQueue = useMemo(
    () =>
      new ResponseQueue(
        {
          apiHost: webAppUrl,
          retryAttempts: 2,
          onResponseSendingFailed: (response) => {
            alert(`Failed to send response: ${JSON.stringify(response, null, 2)}`);
          },
          setSurveyState: setSurveyState,
        },
        surveyState
      ),
    [webAppUrl]
  );
  const [autoFocus, setAutofocus] = useState(false);
  const hasFinishedSingleUseResponse = useMemo(() => {
    if (singleUseResponse && singleUseResponse.finished) {
      return true;
    }
    return false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Not in an iframe, enable autofocus on input fields.
  useEffect(() => {
    if (window.self === window.top) {
      setAutofocus(true);
    }
  }, []);

  const [hiddenFieldsRecord, setHiddenFieldsRecord] = useState<Record<string, string | number | string[]>>();

  useEffect(() => {
    survey.hiddenFields?.fieldIds?.forEach((field) => {
      // set the question and answer to the survey state
      const answer = searchParams?.get(field);
      if (answer) {
        setHiddenFieldsRecord((prev) => {
          return {
            ...prev,
            [field]: answer,
          };
        });
      }
    });
  }, [searchParams, survey.hiddenFields?.fieldIds]);

  useEffect(() => {
    responseQueue.updateSurveyState(surveyState);
  }, [responseQueue, surveyState]);

  if (!surveyState.isResponseFinished() && hasFinishedSingleUseResponse) {
    return <SurveyLinkUsed singleUseMessage={survey.singleUse} />;
  }
  if (survey.verifyEmail && emailVerificationStatus !== "verified") {
    if (emailVerificationStatus === "fishy") {
      return <VerifyEmail survey={survey} isErrorComponent={true} />;
    }
    //emailVerificationStatus === "not-verified"
    return <VerifyEmail survey={survey} />;
  }

  return (
    <>
      <ContentWrapper className="h-full w-full p-0 md:max-w-lg">
        {isPreview && (
          <div className="fixed left-0 top-0 flex w-full items-center justify-between bg-slate-600 p-2 px-4 text-center text-sm text-white shadow-sm">
            <div />
            Survey Preview 👀
            <button
              className="flex items-center rounded-full bg-slate-500 px-3 py-1 hover:bg-slate-400"
              onClick={() =>
                setActiveQuestionId(survey.welcomeCard.enabled ? "start" : survey?.questions[0]?.id)
              }>
              Restart <ArrowPathIcon className="ml-2 h-4 w-4" />
            </button>
          </div>
        )}
        <SurveyInline
          survey={survey}
          brandColor={brandColor}
          formbricksSignature={product.formbricksSignature}
          onDisplay={async () => {
            if (!isPreview) {
              const api = new FormbricksAPI({
                apiHost: webAppUrl,
                environmentId: survey.environmentId,
              });
              const res = await api.client.display.create({
                surveyId: survey.id,
              });
              if (!res.ok) {
                throw new Error("Could not create display");
              }
              const { id } = res.data;

              const newSurveyState = surveyState.copy();
              newSurveyState.updateDisplayId(id);
              setSurveyState(newSurveyState);
            }
          }}
          onResponse={(responseUpdate: TResponseUpdate) => {
            !isPreview &&
              responseQueue.add({
                data: {
                  ...responseUpdate.data,
                  ...hiddenFieldsRecord,
                },
                finished: responseUpdate.finished,
                meta: {
                  url: window.location.href,
                  source: sourceParam || "",
                },
              });
          }}
          onActiveQuestionChange={(questionId) => setActiveQuestionId(questionId)}
          activeQuestionId={activeQuestionId}
          autoFocus={autoFocus}
          prefillResponseData={prefillResponseData}
        />
      </ContentWrapper>
    </>
  );
}
