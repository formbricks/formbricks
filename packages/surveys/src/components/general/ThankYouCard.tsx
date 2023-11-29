import Headline from "@/components/general/Headline";
import RedirectCountDown from "@/components/general/RedirectCountdown";
import Subheader from "@/components/general/Subheader";
import { getLocalizedValue } from "@/lib/utils";
import { TI18nString } from "@formbricks/types/surveys";

interface ThankYouCardProps {
  headline?: TI18nString;
  subheader?: TI18nString;
  redirectUrl: string | null;
  isRedirectDisabled: boolean;
  language: string;
}

export default function ThankYouCard({
  headline,
  subheader,
  redirectUrl,
  isRedirectDisabled,
  language,
}: ThankYouCardProps) {
  return (
    <div className="text-center">
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
        <Headline
          alignTextCenter={true}
          headline={getLocalizedValue(headline, language)}
          questionId="thankYouCard"
        />
        <Subheader subheader={getLocalizedValue(subheader, language)} questionId="thankYouCard" />
        <RedirectCountDown redirectUrl={redirectUrl} isRedirectDisabled={isRedirectDisabled} />
      </div>
    </div>
  );
}
