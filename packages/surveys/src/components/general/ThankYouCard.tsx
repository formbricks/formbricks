import Button from "@/components/buttons/SubmitButton";
import Headline from "@/components/general/Headline";
import QuestionImage from "@/components/general/QuestionImage";
import RedirectCountDown from "@/components/general/RedirectCountdown";
import Subheader from "@/components/general/Subheader";
import { useEffect } from "preact/hooks";

interface ThankYouCardProps {
  headline?: string;
  subheader?: string;
  redirectUrl: string | null;
  isRedirectDisabled: boolean;
  buttonLabel?: string;
  buttonLink?: string;
  imageUrl?: string;
}

export default function ThankYouCard({
  headline,
  subheader,
  redirectUrl,
  isRedirectDisabled,
  buttonLabel,
  buttonLink,
  imageUrl,
}: ThankYouCardProps) {
  useEffect(() => {
    if (!buttonLink) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Enter") {
        window.location.href = buttonLink;
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [buttonLink]);

  return (
    <div className="text-center">
      {imageUrl && <QuestionImage imgUrl={imageUrl} />}

      <div className="text-brand flex items-center justify-center">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke-width="1.5"
          stroke="currentColor"
          class="h-24 w-24">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      </div>

      <span className="bg-shadow mb-[10px] inline-block h-1 w-16 rounded-[100%]"></span>

      <div>
        <Headline alignTextCenter={true} headline={headline} questionId="thankYouCard" />
        <Subheader subheader={subheader} questionId="thankYouCard" />
        <RedirectCountDown redirectUrl={redirectUrl} isRedirectDisabled={isRedirectDisabled} />
        {buttonLabel && (
          <div className="mt-6 flex w-full flex-col items-center justify-center space-y-4">
            <Button
              buttonLabel={buttonLabel}
              isLastQuestion={false}
              onClick={() => {
                if (!buttonLink) return;
                window.location.href = buttonLink;
              }}
            />
            <p class="text-xs">Press Enter ↵</p>
          </div>
        )}
      </div>
    </div>
  );
}
