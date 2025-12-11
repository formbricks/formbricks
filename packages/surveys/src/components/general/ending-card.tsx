import { useEffect } from "preact/hooks";
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
}: EndingCardProps) {
  const { t } = useTranslation();
  const media =
    endingCard.type === "endScreen" && (endingCard.imageUrl ?? endingCard.videoUrl) ? (
      <ElementMedia imgUrl={endingCard.imageUrl} videoUrl={endingCard.videoUrl} />
    ) : null;

  const checkmark = (
    <div className="fb-text-brand fb-flex fb-flex-col fb-items-center fb-justify-center">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth="1.5"
        stroke="currentColor"
        className="fb-h-24 fb-w-24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
      <span className="fb-bg-brand fb-mb-[10px] fb-inline-block fb-h-1 fb-w-16 fb-rounded-[100%]" />
    </div>
  );

  const processAndRedirect = (urlString: string) => {
    try {
      const url = replaceRecallInfo(urlString, responseData, variablesData);
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
  };

  const handleSubmit = () => {
    if (!isRedirectDisabled && endingCard.type === "endScreen" && endingCard.buttonLink) {
      processAndRedirect(endingCard.buttonLink);
    }
  };

  useEffect(() => {
    if (isCurrent) {
      if (!isRedirectDisabled && endingCard.type === "redirectToUrl" && endingCard.url) {
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

    // eslint-disable-next-line react-hooks/exhaustive-deps -- we only want to run this effect when isCurrent changes
  }, [isCurrent]);

  return (
    <ScrollableContainer fullSizeCards={fullSizeCards}>
      <div className="fb-text-center">
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
                      variablesData
                    )}
                    elementId="EndingCard"
                  />
                  <Subheader
                    subheader={replaceRecallInfo(
                      getLocalizedValue(endingCard.subheader, languageCode),
                      responseData,
                      variablesData
                    )}
                    elementId="EndingCard"
                  />
                  {endingCard.buttonLabel ? (
                    <div className="fb-mt-6 fb-flex fb-w-full fb-flex-col fb-items-center fb-justify-center fb-space-y-4">
                      <SubmitButton
                        buttonLabel={replaceRecallInfo(
                          getLocalizedValue(endingCard.buttonLabel, languageCode),
                          responseData,
                          variablesData
                        )}
                        isLastQuestion={false}
                        focus={isCurrent ? autoFocusEnabled : false}
                        onClick={handleSubmit}
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
                  <div className="fb-my-3">
                    <LoadingSpinner />
                  </div>
                )}
              </>
            )}
          </>
        ) : (
          <>
            <div className="fb-my-3">
              <LoadingSpinner />
            </div>
            <h1 className="fb-text-brand">{t("common.sending_responses")}</h1>
          </>
        )}
      </div>
    </ScrollableContainer>
  );
}
