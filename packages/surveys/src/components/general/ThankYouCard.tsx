import { SubmitButton } from "@/components/buttons/SubmitButton";
import { Headline } from "@/components/general/Headline";
import { LoadingSpinner } from "@/components/general/LoadingSpinner";
import { QuestionMedia } from "@/components/general/QuestionMedia";
import { RedirectCountDown } from "@/components/general/RedirectCountdown";
import { Subheader } from "@/components/general/Subheader";
import { ScrollableContainer } from "@/components/wrappers/ScrollableContainer";
import { useEffect } from "preact/hooks";
import { TSurvey } from "@formbricks/types/surveys/types";

interface ThankYouCardProps {
  headline?: string;
  subheader?: string;
  redirectUrl: string | null;
  isRedirectDisabled: boolean;
  buttonLabel?: string;
  buttonLink?: string;
  imageUrl?: string;
  videoUrl?: string;
  isResponseSendingFinished: boolean;
  autoFocusEnabled: boolean;
  isCurrent: boolean;
  survey: TSurvey;
}

export const ThankYouCard = ({
  headline,
  subheader,
  redirectUrl,
  isRedirectDisabled,
  buttonLabel,
  buttonLink,
  imageUrl,
  videoUrl,
  isResponseSendingFinished,
  autoFocusEnabled,
  isCurrent,
  survey,
}: ThankYouCardProps) => {
  const media = imageUrl || videoUrl ? <QuestionMedia imgUrl={imageUrl} videoUrl={videoUrl} /> : null;
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
    if (buttonLink) window.location.replace(buttonLink);
  };

  useEffect(() => {
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
            {media || checkmark}
            <Headline alignTextCenter={true} headline={headline} questionId="thankYouCard" />
            <Subheader subheader={subheader} questionId="thankYouCard" />
            <RedirectCountDown redirectUrl={redirectUrl} isRedirectDisabled={isRedirectDisabled} />
            {buttonLabel && (
              <div className="fb-mt-6 fb-flex fb-w-full fb-flex-col fb-items-center fb-justify-center fb-space-y-4">
                <SubmitButton
                  buttonLabel={buttonLabel}
                  isLastQuestion={false}
                  focus={autoFocusEnabled}
                  onClick={handleSubmit}
                />
              </div>
            )}
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
