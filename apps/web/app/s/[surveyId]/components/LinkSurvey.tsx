"use client";

import SurveyLinkUsed from "@/app/s/[surveyId]/components/SurveyLinkUsed";
import VerifyEmail from "@/app/s/[surveyId]/components/VerifyEmail";
import { getPrefillValue } from "@/app/s/[surveyId]/lib/prefilling";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { FormbricksAPI } from "@formbricks/api";
import { ResponseQueue } from "@formbricks/lib/responseQueue";
import { SurveyState } from "@formbricks/lib/surveyState";
import { TProduct } from "@formbricks/types/product";
import { TResponse, TResponseUpdate } from "@formbricks/types/responses";
import { TUploadFileConfig } from "@formbricks/types/storage";
import { TSurvey } from "@formbricks/types/surveys";
import { ClientLogo } from "@formbricks/ui/ClientLogo";
import { ContentWrapper } from "@formbricks/ui/ContentWrapper";
import { ResetProgressButton } from "@formbricks/ui/ResetProgressButton";
import { SurveyInline } from "@formbricks/ui/Survey";

let setIsError = (_: boolean) => {};
let setIsResponseSendingFinished = (_: boolean) => {};
let setQuestionId = (_: string) => {};

interface LinkSurveyProps {
  survey: TSurvey;
  product: TProduct;
  userId?: string;
  emailVerificationStatus?: string;
  singleUseId?: string;
  singleUseResponse?: TResponse;
  webAppUrl: string;
  responseCount?: number;
  verifiedEmail?: string;
  languageCode: string;
}

export default function LinkSurvey({
  survey,
  product,
  userId,
  emailVerificationStatus,
  singleUseId,
  singleUseResponse,
  webAppUrl,
  responseCount,
  verifiedEmail,
  languageCode,
}: LinkSurveyProps) {
  const responseId = singleUseResponse?.id;
  const searchParams = useSearchParams();
  const isPreview = searchParams?.get("preview") === "true";
  const sourceParam = searchParams?.get("source");
  const suId = searchParams?.get("suId");
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
    return new SurveyState(survey.id, singleUseId, responseId, userId);
  }, [survey.id, singleUseId, responseId, userId]);

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
    // For safari on mobile devices, scroll is a bit off due to dynamic height of address bar, so on inital load, we scroll to the bottom
    window.scrollTo({
      top: document.body.scrollHeight,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      return <VerifyEmail survey={survey} isErrorComponent={true} languageCode={languageCode} />;
    }
    //emailVerificationStatus === "not-verified"
    return <VerifyEmail singleUseId={suId ?? ""} survey={survey} languageCode={languageCode} />;
  }

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
    <div className="flex h-screen items-center justify-center" style={{ height: "90svh" }}>
      {!determineStyling().isLogoHidden && product.logo?.url && <ClientLogo product={product} />}
      <ContentWrapper className="w-full p-0 md:max-w-md">
        {isPreview && (
          <div className="fixed left-0 top-0 flex w-full items-center justify-between bg-slate-600 p-2 px-4 text-center text-sm text-white shadow-sm">
            <div />
            Survey Preview 👀
            <ResetProgressButton
              onClick={() => setQuestionId(survey.welcomeCard.enabled ? "start" : survey?.questions[0]?.id)}
            />
          </div>
        )}

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
                  ...hiddenFieldsRecord,
                  ...getVerifiedEmail,
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
          responseCount={responseCount}
          getSetQuestionId={(f: (value: string) => void) => {
            setQuestionId = f;
          }}
          startAtQuestionId={startAt && isStartAtValid ? startAt : undefined}
        />
      </ContentWrapper>
    </div>
  );
}
