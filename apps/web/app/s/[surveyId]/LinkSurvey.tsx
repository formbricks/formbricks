"use client";

import ContentWrapper from "@/components/shared/ContentWrapper";
import { SurveyInline } from "@/components/shared/Survey";
import { createDisplay } from "@formbricks/lib/client/display";
import { cn } from "@formbricks/lib/cn";
import { WEBAPP_URL } from "@formbricks/lib/constants";
import { ResponseQueue } from "@formbricks/lib/responseQueue";
import { SurveyState } from "@formbricks/lib/surveyState";
import { TProduct } from "@formbricks/types/v1/product";
import { TSurvey } from "@formbricks/types/v1/surveys";
import { ArrowPathIcon } from "@heroicons/react/24/solid";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

interface LinkSurveyProps {
  survey: TSurvey;
  product: TProduct;
}

export default function LinkSurvey({ survey, product }: LinkSurveyProps) {
  const searchParams = useSearchParams();
  const isPreview = searchParams?.get("preview") === "true";
  const [surveyState, setSurveyState] = useState(new SurveyState(survey.id));
  const [activeQuestionId, setActiveQuestionId] = useState<string>(survey.questions[0].id);

  const responseQueue = useMemo(
    () =>
      new ResponseQueue(
        {
          apiHost: typeof window !== "undefined" ? window.location?.origin : WEBAPP_URL,
          retryAttempts: 2,
          onResponseSendingFailed: (response) => {
            alert(`Failed to send response: ${JSON.stringify(response, null, 2)}`);
          },
          setSurveyState: setSurveyState,
        },
        surveyState
      ),
    []
  );

  const [autoFocus, setAutofocus] = useState(false);

  // Not in an iframe, enable autofocus on input fields.
  useEffect(() => {
    if (window.self === window.top) {
      setAutofocus(true);
    }
  }, []);

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
          onDisplay={() => createDisplay({ surveyId: survey.id }, window?.location?.origin)}
          onResponse={(responseUpdate) => {
            responseQueue.add(responseUpdate);
          }}
          onActiveQuestionChange={(questionId) => setActiveQuestionId(questionId)}
          activeQuestionId={activeQuestionId}
          autoFocus={autoFocus}
        />
      </ContentWrapper>
    </>
  );
}
