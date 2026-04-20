import { useCallback, useEffect } from "preact/hooks";
import { useTranslation } from "react-i18next";
import { type TJsEnvironmentStateSurvey } from "@formbricks/types/js";
import { type TResponseData, type TResponseVariables } from "@formbricks/types/responses";
import { type TSurveyEndScreenCard, type TSurveyRedirectUrlCard } from "@formbricks/types/surveys/types";
import { SubmitButton } from "@/components/buttons/submit-button";
import { ElementMedia } from "@/components/general/element-media";
import { Headline } from "@/components/general/headline";
import { LoadingSpinner } from "@/components/general/loading-spinner";
import { Subheader } from "@/components/general/subheader";
import { ScrollableContainer } from "@/components/wrappers/scrollable-container";
import { getLocalizedValue } from "@/lib/i18n";
import { replaceRecallInfo } from "@/lib/recall";

interface EndingCardProps {
  survey: TJsEnvironmentStateSurvey;
  endingCard: TSurveyEndScreenCard | TSurveyRedirectUrlCard;
  isRedirectDisabled: boolean;
  isResponseSendingFinished: boolean;
  autoFocusEnabled: boolean;
  isCurrent: boolean;
  languageCode: string;
  responseData: TResponseData;
  variablesData: TResponseVariables;
  onOpenExternalURL?: (url: string) => void | Promise<void>;
  isPreviewMode: boolean;
  fullSizeCards: boolean;
  isOfflineWithPending?: boolean;
}

export function EndingCard({
  survey,
  endingCard,
  isRedirectDisabled,
  isResponseSendingFinished,
  autoFocusEnabled,
  isCurrent,
  languageCode,
  responseData,
  variablesData,
  onOpenExternalURL,
  isPreviewMode,
  fullSizeCards,
  isOfflineWithPending = false,
}: Readonly<EndingCardProps>) {
  const { t } = useTranslation();
  const media =
    endingCard.type === "endScreen" && (endingCard.imageUrl ?? endingCard.videoUrl) ? (
      <ElementMedia imgUrl={endingCard.imageUrl} videoUrl={endingCard.videoUrl} />
    ) : null;

  const checkmark = (
    <div className="text-brand flex flex-col items-center justify-center">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth="1.5"
        stroke="currentColor"
        className="h-24 w-24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
      <span className="bg-brand mb-[10px] inline-block h-1 w-16 rounded-[100%]" />
    </div>
  );

  const processAndRedirect = useCallback(
    (urlString: string) => {
      try {
        const url = replaceRecallInfo(urlString, responseData, variablesData, languageCode);
        if (url && new URL(url)) {
          if (onOpenExternalURL) {
            onOpenExternalURL(url);
          } else {
            window.top?.location.replace(url);
          }
        }
      } catch (error) {
        console.error("Invalid URL after recall processing:", error);
      }
    },
    [languageCode, onOpenExternalURL, responseData, variablesData]
  );

  const handleSubmit = useCallback(() => {
    if (isOfflineWithPending) return;
    if (!isRedirectDisabled && endingCard.type === "endScreen" && endingCard.buttonLink) {
      processAndRedirect(endingCard.buttonLink);
    }
  }, [endingCard, isOfflineWithPending, isRedirectDisabled, processAndRedirect]);

  useEffect(() => {
    if (isCurrent) {
      if (
        !isRedirectDisabled &&
        endingCard.type === "redirectToUrl" &&
        endingCard.url &&
        isResponseSendingFinished
      ) {
        processAndRedirect(endingCard.url);
      }
    }

    const handleEnter = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        handleSubmit();
      }
    };

    if (isCurrent && survey.type === "link") {
      document.addEventListener("keydown", handleEnter);
    } else {
      document.removeEventListener("keydown", handleEnter);
    }

    return () => {
      document.removeEventListener("keydown", handleEnter);
    };
  }, [
    endingCard,
    handleSubmit,
    isCurrent,
    isRedirectDisabled,
    isResponseSendingFinished,
    processAndRedirect,
    survey.type,
  ]);

  return (
    <ScrollableContainer fullSizeCards={fullSizeCards}>
      <div className="text-center">
        {isResponseSendingFinished ? (
          <>
            {endingCard.type === "endScreen" && (
              <div>
                {media ?? checkmark}
                <div>
                  <Headline
                    alignTextCenter
                    headline={replaceRecallInfo(
                      getLocalizedValue(endingCard.headline, languageCode),
                      responseData,
                      variablesData,
                      languageCode
                    )}
                    elementId="EndingCard"
                  />
                  <Subheader
                    subheader={replaceRecallInfo(
                      getLocalizedValue(endingCard.subheader, languageCode),
                      responseData,
                      variablesData,
                      languageCode
                    )}
                    elementId="EndingCard"
                  />
                  {endingCard.buttonLabel ? (
                    <div className="mt-6 flex w-full flex-col items-center justify-center space-y-4">
                      <SubmitButton
                        buttonLabel={replaceRecallInfo(
                          getLocalizedValue(endingCard.buttonLabel, languageCode),
                          responseData,
                          variablesData,
                          languageCode
                        )}
                        isLastQuestion={false}
                        focus={isCurrent ? autoFocusEnabled : false}
                        onClick={handleSubmit}
                        disabled={isOfflineWithPending}
                      />
                    </div>
                  ) : null}
                </div>
              </div>
            )}
            {endingCard.type === "redirectToUrl" && (
              <>
                {isPreviewMode ? (
                  <div>
                    <Headline
                      alignTextCenter
                      headline={t("common.respondents_will_not_see_this_card")}
                      elementId="EndingCard"
                    />
                    <Subheader
                      subheader={t("common.they_will_be_redirected_immediately")}
                      elementId="EndingCard"
                    />
                  </div>
                ) : (
                  <div className="my-3">
                    <LoadingSpinner />
                  </div>
                )}
              </>
            )}
          </>
        ) : (
          <>
            <div className="my-3">
              <LoadingSpinner />
            </div>
            <h1 className="text-brand">{t("common.sending_responses")}</h1>
          </>
        )}
        {isOfflineWithPending && isResponseSendingFinished && (
          <div className="mx-auto mt-5 flex w-fit items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="h-4 w-4 shrink-0 text-amber-500">
              <path
                fillRule="evenodd"
                d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.345 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 6a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 6zm0 9a1 1 0 100-2 1 1 0 000 2z"
                clipRule="evenodd"
              />
            </svg>
            <p className="text-xs text-amber-700">{t("common.response_saved_offline")}</p>
          </div>
        )}
      </div>
    </ScrollableContainer>
  );
}
