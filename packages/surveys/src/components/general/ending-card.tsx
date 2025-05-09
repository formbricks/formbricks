import { useEffect } from "react";
import { type TJsEnvironmentStateSurvey } from "@formbricks/types/js";
import { type TResponseData, type TResponseVariables } from "@formbricks/types/responses";
import { type TSurveyEndScreenCard, type TSurveyRedirectUrlCard } from "@formbricks/types/surveys/types";
import { useConfig } from "@formbricks/web3/src/hooks/useConfig";
import { getLocalizedValue } from "../../lib/i18n";
import { replaceRecallInfo } from "../../lib/recall";
import { SubmitButton } from "../buttons/submit-button";
import { Headline } from "../general/headline";
import { LoadingSpinner } from "../general/loading-spinner";
import { QuestionMedia } from "../general/question-media";
import { Subheader } from "../general/subheader";
import { ScrollableContainer } from "../wrappers/scrollable-container";

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
  deployTokenResponse?: string;
  onOpenExternalURL?: (url: string) => void | Promise<void>;
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
  deployTokenResponse,
  onOpenExternalURL,
}: EndingCardProps) {
  const { config } = useConfig();

  const media =
    endingCard.type === "endScreen" && (endingCard.imageUrl ?? endingCard.videoUrl) ? (
      <QuestionMedia imgUrl={endingCard.imageUrl} videoUrl={endingCard.videoUrl} />
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

  const getParseTokenDeploymentDetails = () => {
    if (!deployTokenResponse) {
      return null;
    }

    try {
      const parsed: { transactionHash: string; tokenAddress: string } = JSON.parse(deployTokenResponse);
      return parsed;
    } catch (error) {
      console.error("Failed to parse deployTokenResponse:", error);
      return null;
    }
  };

  const tokenDeploymentDetails = getParseTokenDeploymentDetails();

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
    <ScrollableContainer>
      <div className="text-center">
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
                    : "Respondents will not see this card"
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
              {tokenDeploymentDetails && tokenDeploymentDetails.tokenAddress && (
                <div className="mb-1 text-sm">
                  <span className="font-medium">Token Address:</span>{" "}
                  <a
                    href={`${config.URLS.EXPLORER}/token/${tokenDeploymentDetails.tokenAddress}`}
                    target="_blank"
                    className="text-blue-600 underline">
                    {tokenDeploymentDetails.tokenAddress}
                  </a>
                </div>
              )}
              {endingCard.type === "endScreen" && endingCard.buttonLabel ? (
                <div className="mt-6 flex w-full flex-col items-center justify-center space-y-4">
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
            <div className="my-3">
              <LoadingSpinner />
            </div>
            <h1 className="text-brand">Sending responses...</h1>
          </>
        )}
      </div>
    </ScrollableContainer>
  );
}
