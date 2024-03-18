"use client";

import SurveyLinkUsed from "@/app/s/[surveyId]/components/SurveyLinkUsed";
import VerifyEmail from "@/app/s/[surveyId]/components/VerifyEmail";
import { getPrefillResponseData } from "@/app/s/[surveyId]/lib/prefilling";
import { RefreshCcwIcon } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { FormbricksAPI } from "@formbricks/api";
import { ResponseQueue } from "@formbricks/lib/responseQueue";
import { SurveyState } from "@formbricks/lib/surveyState";
import { TProduct } from "@formbricks/types/product";
import { TResponse, TResponseData, TResponseUpdate } from "@formbricks/types/responses";
import { TUploadFileConfig } from "@formbricks/types/storage";
import { TSurvey } from "@formbricks/types/surveys";
import ContentWrapper from "@formbricks/ui/ContentWrapper";
import { SurveyInline } from "@formbricks/ui/Survey";

let setIsError = (_: boolean) => {};
let setIsResponseSendingFinished = (_: boolean) => {};

interface LinkSurveyProps {
  survey: TSurvey;
  product: TProduct;
  userId?: string;
  emailVerificationStatus?: string;
  prefillAnswer?: string;
  singleUseId?: string;
  singleUseResponse?: TResponse;
  webAppUrl: string;
  responseCount?: number;
  verifiedEmail?: string;
}

export default function LinkSurvey({
  survey,
  product,
  userId,
  emailVerificationStatus,
  prefillAnswer,
  singleUseId,
  singleUseResponse,
  webAppUrl,
  responseCount,
  verifiedEmail,
}: LinkSurveyProps) {
  const responseId = singleUseResponse?.id;
  const searchParams = useSearchParams();
  const isPreview = searchParams?.get("preview") === "true";
  const sourceParam = searchParams?.get("source");
  const suId = searchParams?.get("suId");
  const startAt = searchParams?.get("startAt");

  const isStartAtValid = useMemo(() => {
    if (!startAt) return false;
    if (survey?.welcomeCard.enabled && startAt === "start") return true;

    const isValid = survey?.questions.some((question) => question.id === startAt);

    // To remove startAt query param from URL if it is not valid:
    if (!isValid && typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.delete("startAt");
      window.history.replaceState({}, "", url.toString());
    }

    return isValid;
  }, [survey, startAt]);

  // pass in the responseId if the survey is a single use survey, ensures survey state is updated with the responseId
  const [surveyState, setSurveyState] = useState(new SurveyState(survey.id, singleUseId, responseId, userId));
  const [activeQuestionId, setActiveQuestionId] = useState<string>(
    startAt && isStartAtValid ? startAt : survey.welcomeCard.enabled ? "start" : survey?.questions[0]?.id
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
          environmentId: survey.environmentId,
          retryAttempts: 2,
          onResponseSendingFailed: () => {
            setIsError(true);
          },
          onResponseSendingFinished: () => {
            // when response of current question is processed successfully
            setIsResponseSendingFinished(true);
          },
          setSurveyState: setSurveyState,
        },
        surveyState
      ),
    [webAppUrl, survey.environmentId, surveyState]
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

  const hiddenFieldsRecord = useMemo<Record<string, string | number | string[]> | null>(() => {
    const fieldsRecord: Record<string, string | number | string[]> = {};
    let fieldsSet = false;

    survey.hiddenFields?.fieldIds?.forEach((field) => {
      const answer = searchParams?.get(field);
      if (answer) {
        fieldsRecord[field] = answer;
        fieldsSet = true;
      }
    });

    // Only return the record if at least one field was set.
    return fieldsSet ? fieldsRecord : null;
  }, [searchParams, survey.hiddenFields?.fieldIds]);

  const getVerifiedEmail = useMemo<Record<string, string> | null>(() => {
    if (survey.verifyEmail && verifiedEmail) {
      return { verifiedEmail: verifiedEmail };
    } else {
      return null;
    }
  }, [survey.verifyEmail, verifiedEmail]);

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
    return <VerifyEmail singleUseId={suId ?? ""} survey={survey} />;
  }

  return (
    <>
      <ContentWrapper className="my-12 h-full w-full p-0 md:max-w-md">
        {isPreview && (
          <div className="fixed left-0 top-0 flex w-full items-center justify-between bg-slate-600 p-2 px-4 text-center text-sm text-white shadow-sm">
            <div />
            Survey Preview 👀
            <button
              type="button"
              className="flex items-center rounded-full bg-slate-500 px-3 py-1 hover:bg-slate-400"
              onClick={() =>
                setActiveQuestionId(survey.welcomeCard.enabled ? "start" : survey?.questions[0]?.id)
              }>
              Restart <RefreshCcwIcon className="ml-2 h-4 w-4" />
            </button>
          </div>
        )}
        <SurveyInline
          survey={survey}
          brandColor={brandColor}
          isBrandingEnabled={product.linkSurveyBranding}
          getSetIsError={(f: (value: boolean) => void) => {
            setIsError = f;
          }}
          getSetIsResponseSendingFinished={
            !isPreview
              ? (f: (value: boolean) => void) => {
                  setIsResponseSendingFinished = f;
                }
              : undefined
          }
          onRetry={() => {
            setIsError(false);
            responseQueue.processQueue();
          }}
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
                  ...getVerifiedEmail,
                },
                ttc: responseUpdate.ttc,
                finished: responseUpdate.finished,
                meta: {
                  url: window.location.href,
                  source: sourceParam || "",
                },
              });
          }}
          onFileUpload={async (file: File, params: TUploadFileConfig) => {
            const api = new FormbricksAPI({
              apiHost: webAppUrl,
              environmentId: survey.environmentId,
            });

            const uploadedUrl = await api.client.storage.uploadFile(file, params);
            return uploadedUrl;
          }}
          onActiveQuestionChange={(questionId) => setActiveQuestionId(questionId)}
          activeQuestionId={activeQuestionId}
          autoFocus={autoFocus}
          prefillResponseData={prefillResponseData}
          responseCount={responseCount}
        />
      </ContentWrapper>
    </>
  );
}
