"use client";

import ContentWrapper from "@/components/shared/ContentWrapper";
import { SurveyInline } from "@/components/shared/Survey";
import { createDisplay } from "@formbricks/lib/client/display";
import { ResponseQueue } from "@formbricks/lib/responseQueue";
import { SurveyState } from "@formbricks/lib/surveyState";
import { TProduct } from "@formbricks/types/v1/product";
import { TSurvey } from "@formbricks/types/v1/surveys";
import { ArrowPathIcon } from "@heroicons/react/24/solid";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import VerifyEmail from "@/app/s/[surveyId]/VerifyEmail";
import { getPrefillResponseData } from "@/app/s/[surveyId]/prefilling";
import { TResponseData, TResponseUpdate } from "@formbricks/types/v1/responses";

interface LinkSurveyProps {
  survey: TSurvey;
  product: TProduct;
  personId?: string;
  emailVerificationStatus?: string;
  prefillAnswer?: string;
  webAppUrl: string;
}

export default function LinkSurvey({
  survey,
  product,
  personId,
  emailVerificationStatus,
  prefillAnswer,
  webAppUrl,
}: LinkSurveyProps) {
  const searchParams = useSearchParams();
  const isPreview = searchParams?.get("preview") === "true";
  const [surveyState, setSurveyState] = useState(new SurveyState(survey.id));
  const [activeQuestionId, setActiveQuestionId] = useState<string>(survey.questions[0].id);
  const [displayId, setDisplayId] = useState<string>();
  const prefillResponseData: TResponseData | undefined = prefillAnswer
    ? getPrefillResponseData(survey.questions[0], survey, prefillAnswer)
    : undefined;

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
          personId,
        },
        surveyState
      ),
    [personId, webAppUrl]
  );
  const [autoFocus, setAutofocus] = useState(false);

  // Not in an iframe, enable autofocus on input fields.
  useEffect(() => {
    if (window.self === window.top) {
      setAutofocus(true);
    }
  }, []);

  useEffect(() => {
    responseQueue.updateSurveyState(surveyState);
  }, [responseQueue, surveyState]);

  if (emailVerificationStatus && emailVerificationStatus !== "verified") {
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
              onClick={() => setActiveQuestionId(survey.questions[0].id)}>
              Restart <ArrowPathIcon className="ml-2 h-4 w-4" />
            </button>
          </div>
        )}
        <SurveyInline
          survey={survey}
          brandColor={product.brandColor}
          formbricksSignature={product.formbricksSignature}
          onDisplay={async () => {
            if (!isPreview) {
              const { id } = await createDisplay({ surveyId: survey.id }, window?.location?.origin);
              setDisplayId(id);
              const newSurveyState = surveyState.copy();
              newSurveyState.updateDisplayId(id);
              setSurveyState(newSurveyState);
            }
          }}
          onResponse={(responseUpdate: TResponseUpdate) => {
            responseUpdate.displayId = displayId!;
            !isPreview && responseQueue.add(responseUpdate);
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
