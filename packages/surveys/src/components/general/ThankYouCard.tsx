import { SubmitButton } from "@/components/buttons/SubmitButton";
import { Headline } from "@/components/general/Headline";
import { LoadingSpinner } from "@/components/general/LoadingSpinner";
import { QuestionMedia } from "@/components/general/QuestionMedia";
import { RedirectCountDown } from "@/components/general/RedirectCountdown";
import { Subheader } from "@/components/general/Subheader";
import { ScrollableContainer } from "@/components/wrappers/ScrollableContainer";
import { useEffect } from "preact/hooks";

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
}: ThankYouCardProps) => {
  const media = imageUrl || videoUrl ? <QuestionMedia imgUrl={imageUrl} videoUrl={videoUrl} /> : null;
  const checkmark = (
    <div className="text-brand flex flex-col items-center justify-center">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth="1.5"
        stroke="currentColor"
        class="h-24 w-24">
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
      <span className="bg-brand mb-[10px] inline-block h-1 w-16 rounded-[100%]"></span>
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

    if (isCurrent) {
      document.addEventListener("keydown", handleEnter);
    } else {
      document.removeEventListener("keydown", handleEnter);
    }

    return () => {
      document.removeEventListener("keydown", handleEnter);
    };
  }, [isCurrent]);

  return (
    <ScrollableContainer>
      <div className="text-center">
        {isResponseSendingFinished ? (
          <>
            {media || checkmark}
            <Headline alignTextCenter={true} headline={headline} questionId="thankYouCard" />
            <Subheader subheader={subheader} questionId="thankYouCard" />
            <RedirectCountDown redirectUrl={redirectUrl} isRedirectDisabled={isRedirectDisabled} />
            {buttonLabel && (
              <div className="mt-6 flex w-full flex-col items-center justify-center space-y-4">
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
            <div className="my-3">
              <LoadingSpinner />
            </div>
            <h1 className="text-brand">Sending responses...</h1>
          </>
        )}
      </div>
    </ScrollableContainer>
  );
};
