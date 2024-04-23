import Button from "@/components/buttons/SubmitButton";
import Headline from "@/components/general/Headline";
import { QuestionMedia } from "@/components/general/QuestionMedia";
import RedirectCountDown from "@/components/general/RedirectCountdown";
import Subheader from "@/components/general/Subheader";
import { ScrollableContainer } from "@/components/wrappers/ScrollableContainer";

import { getLocalizedValue } from "@formbricks/lib/i18n/utils";
import { TI18nString } from "@formbricks/types/surveys";

interface ThankYouCardProps {
  headline?: TI18nString;
  subheader?: TI18nString;
  redirectUrl: string | null;
  isRedirectDisabled: boolean;
  languageCode: string;
  buttonLabel?: TI18nString;
  buttonLink?: string;
  imageUrl?: string;
  videoUrl?: string;
  replaceRecallInfo: (text: string) => string;
  isResponseSendingFinished: boolean;
  isInIframe: boolean;
}

export const ThankYouCard = ({
  headline,
  subheader,
  redirectUrl,
  isRedirectDisabled,
  languageCode,
  buttonLabel,
  buttonLink,
  imageUrl,
  videoUrl,
  replaceRecallInfo,
  isResponseSendingFinished,
  isInIframe,
}: ThankYouCardProps) => {
  return (
    <div className="text-center">
      <ScrollableContainer>
        <div>
          {imageUrl || videoUrl ? (
            <QuestionMedia imgUrl={imageUrl} videoUrl={videoUrl} />
          ) : (
            <div>
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
              <span className="bg-brand mb-[10px] inline-block h-1 w-16 rounded-[100%]"></span>
            </div>
          )}
          <Headline
            alignTextCenter={true}
            headline={replaceRecallInfo(getLocalizedValue(headline, languageCode))}
            questionId="thankYouCard"
          />
          <Subheader
            subheader={replaceRecallInfo(getLocalizedValue(subheader, languageCode))}
            questionId="thankYouCard"
          />
          <RedirectCountDown redirectUrl={redirectUrl} isRedirectDisabled={isRedirectDisabled} />
        </div>
      </ScrollableContainer>

      {buttonLabel && isResponseSendingFinished && (
        <div className=" mt-4 flex w-full flex-col items-center justify-center space-y-4">
          <Button
            buttonLabel={getLocalizedValue(buttonLabel, languageCode)}
            isLastQuestion={false}
            focus={!isInIframe}
            onClick={() => {
              if (!buttonLink) return;
              window.location.replace(buttonLink);
            }}
          />
          <p class="text-subheading text-xs">Press Enter ↵</p>
        </div>
      )}
    </div>
  );
};
