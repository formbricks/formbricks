import { SubmitButton } from "@/components/buttons/SubmitButton";
import { Headline } from "@/components/general/Headline";
import { LoadingSpinner } from "@/components/general/LoadingSpinner";
import { QuestionMedia } from "@/components/general/QuestionMedia";
import { Subheader } from "@/components/general/Subheader";
import { ScrollableContainer } from "@/components/wrappers/ScrollableContainer";
import { replaceRecallInfo } from "@/lib/recall";
import { useEffect } from "preact/hooks";
import { getLocalizedValue } from "@formbricks/lib/i18n/utils";
import { TResponseData } from "@formbricks/types/responses";
import { TSurvey, TSurveyEndScreenCard, TSurveyRedirectUrlCard } from "@formbricks/types/surveys/types";

interface EndingCardProps {
  survey: TSurvey;
  endingCard: TSurveyEndScreenCard | TSurveyRedirectUrlCard;
  isRedirectDisabled: boolean;
  isResponseSendingFinished: boolean;
  autoFocusEnabled: boolean;
  isCurrent: boolean;
  languageCode: string;
  responseData: TResponseData;
}

export const EndingCard = ({
  survey,
  endingCard,
  isRedirectDisabled,
  isResponseSendingFinished,
  autoFocusEnabled,
  isCurrent,
  languageCode,
  responseData,
}: EndingCardProps) => {
  const media =
    endingCard.type === "endScreen" && (endingCard.imageUrl || endingCard.videoUrl) ? (
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
        class="fb-h-24 fb-w-24">
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
      <span className="fb-bg-brand fb-mb-[10px] fb-inline-block fb-h-1 fb-w-16 fb-rounded-[100%]"></span>
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

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCurrent]);

  return (
    <ScrollableContainer>
      <div className="fb-text-center">
        {isResponseSendingFinished ? (
          <>
            {endingCard.type === "endScreen" && (media || checkmark)}
            <div>
              <Headline
                alignTextCenter={true}
                headline={
                  endingCard.type === "endScreen"
                    ? replaceRecallInfo(
                        getLocalizedValue(endingCard.headline, languageCode),
                        responseData,
                        survey.variables
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
                        survey.variables
                      )
                    : "They will be forwarded immediately"
                }
                questionId="EndingCard"
              />
              {endingCard.type === "endScreen" && endingCard.buttonLabel && (
                <div className="fb-mt-6 fb-flex fb-w-full fb-flex-col fb-items-center fb-justify-center fb-space-y-4">
                  <SubmitButton
                    buttonLabel={replaceRecallInfo(
                      getLocalizedValue(endingCard.buttonLabel, languageCode),
                      responseData,
                      survey.variables
                    )}
                    isLastQuestion={false}
                    focus={autoFocusEnabled}
                    onClick={handleSubmit}
                  />
                </div>
              )}
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
};
