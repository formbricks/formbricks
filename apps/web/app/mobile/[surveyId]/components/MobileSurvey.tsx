"use client";

import { getPrefillValue } from "@/app/s/[surveyId]/lib/prefilling";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { FormbricksAPI } from "@formbricks/api";
import { ResponseQueue } from "@formbricks/lib/responseQueue";
import { SurveyState } from "@formbricks/lib/surveyState";
import { TProduct } from "@formbricks/types/product";
import { TResponseUpdate } from "@formbricks/types/responses";
import { TUploadFileConfig } from "@formbricks/types/storage";
import { TSurvey } from "@formbricks/types/surveys";
import { ClientLogo } from "@formbricks/ui/ClientLogo";
import { ResetProgressButton } from "@formbricks/ui/ResetProgressButton";
import { SurveyInline } from "@formbricks/ui/Survey";

declare global {
  interface Window {
    ReactNativeWebView: Window;
  }
}

let setIsError = (_: boolean) => {};
let setIsResponseSendingFinished = (_: boolean) => {};
let setQuestionId = (_: string) => {};

interface MobileSurveyProps {
  survey: TSurvey;
  product: TProduct;
  userId?: string;
  webAppUrl: string;
  languageCode: string;
}

export const MobileSurvey = ({ survey, product, userId, webAppUrl, languageCode }: MobileSurveyProps) => {
  const searchParams = useSearchParams();
  const isPreview = searchParams?.get("preview") === "true";
  const sourceParam = searchParams?.get("source");
  // const isMobile = searchParams?.get("mobile") === "true";
  const defaultLanguageCode = survey.languages?.find((surveyLanguage) => {
    return surveyLanguage.default === true;
  })?.language.code;

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
  let surveyState = useMemo(() => {
    return new SurveyState(survey.id, userId);
  }, [survey.id, userId]);

  const prefillValue = getPrefillValue(survey, searchParams, languageCode);

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
        },
        surveyState
      ),
    [webAppUrl, survey.environmentId, surveyState]
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

  const determineStyling = () => {
    // allow style overwrite is disabled from the product
    if (!product.styling.allowStyleOverwrite) {
      return product.styling;
    }

    // allow style overwrite is enabled from the product
    if (product.styling.allowStyleOverwrite) {
      // survey style overwrite is disabled
      if (!survey.styling?.overwriteThemeStyling) {
        return product.styling;
      }

      // survey style overwrite is enabled
      return survey.styling;
    }

    return product.styling;
  };

  return (
    <div className="flex max-h-dvh min-h-dvh items-end justify-center overflow-clip md:items-center">
      {!determineStyling().isLogoHidden && product.logo?.url && <ClientLogo product={product} />}
      <div className="w-full space-y-6 p-0 md:max-w-md">
        <SurveyInline
          survey={survey}
          styling={determineStyling()}
          languageCode={languageCode}
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
                userId,
              });
              if (!res.ok) {
                throw new Error("Could not create display");
              }
              const { id } = res.data;

              surveyState.updateDisplayId(id);
              responseQueue.updateSurveyState(surveyState);
            }
          }}
          onResponse={(responseUpdate: TResponseUpdate) => {
            !isPreview &&
              responseQueue.add({
                data: {
                  ...responseUpdate.data,
                },
                ttc: responseUpdate.ttc,
                finished: responseUpdate.finished,
                language:
                  languageCode === "default" && defaultLanguageCode ? defaultLanguageCode : languageCode,
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
          autoFocus={autoFocus}
          prefillResponseData={prefillValue}
          getSetQuestionId={(f: (value: string) => void) => {
            setQuestionId = f;
          }}
          startAtQuestionId={startAt && isStartAtValid ? startAt : undefined}
        />
      </div>
    </div>
  );
};
