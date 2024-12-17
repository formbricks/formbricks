import { SubmitButton } from "@/components/buttons/submit-button";
import { Headline } from "@/components/general/headline";
import { LoadingSpinner } from "@/components/general/loading-spinner";
import { QuestionMedia } from "@/components/general/question-media";
import { Subheader } from "@/components/general/subheader";
import { ScrollableContainer } from "@/components/wrappers/scrollable-container";
import { replaceRecallInfo } from "@/lib/recall";
import { useEffect } from "preact/hooks";
import { getLocalizedValue } from "@formbricks/lib/i18n/utils";
import { type TJsEnvironmentStateSurvey } from "@formbricks/types/js";
import { type TResponseData, type TResponseVariables } from "@formbricks/types/responses";
import { type TSurveyEndScreenCard, type TSurveyRedirectUrlCard } from "@formbricks/types/surveys/types";

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
}: EndingCardProps) {
  const media =
    endingCard.type === "endScreen" && (endingCard.imageUrl ?? endingCard.videoUrl) ? (
      <QuestionMedia imgUrl={endingCard.imageUrl} videoUrl={endingCard.videoUrl} />
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

  const handleSubmit = () => {
    if (!isRedirectDisabled && endingCard.type === "endScreen" && endingCard.buttonLink) {
      window.top?.location.replace(endingCard.buttonLink);
    }
  };

  useEffect(() => {
    if (isCurrent) {
      if (!isRedirectDisabled && endingCard.type === "redirectToUrl" && endingCard.url) {
        window.top?.location.replace(endingCard.url);
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
    <ScrollableContainer>
      <div className="fb-text-center">
        {isResponseSendingFinished ? (
          <>
            {endingCard.type === "endScreen" && (media ?? checkmark)}
            <div>
              <Headline
                alignTextCenter
                headline={
                  endingCard.type === "endScreen"
                    ? replaceRecallInfo(
                        getLocalizedValue(endingCard.headline, languageCode),
                        responseData,
                        variablesData
                      )
                    : "Respondants will not see this card"
                }
                questionId="EndingCard"
              />
              <Subheader
                subheader={
                  endingCard.type === "endScreen"
                    ? replaceRecallInfo(
                        getLocalizedValue(endingCard.subheader, languageCode),
                        responseData,
                        variablesData
                      )
                    : "They will be forwarded immediately"
                }
                questionId="EndingCard"
              />
              {endingCard.type === "endScreen" && endingCard.buttonLabel ? (
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
          </>
        ) : (
          <>
            <div className="fb-my-3">
              <LoadingSpinner />
            </div>
            <h1 className="fb-text-brand">Sending responses...</h1>
          </>
        )}
      </div>
    </ScrollableContainer>
  );
}
