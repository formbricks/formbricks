import { useTranslate } from "@tolgee/react";
import { InfoIcon, XIcon } from "lucide-react";
import { Dispatch, SetStateAction } from "react";

interface WelcomeBannerProps {
  showWelcomeBanner: boolean;
  isLoading: boolean;
  setShowWelcomeBanner: Dispatch<SetStateAction<boolean>>;
}

const WelcomeBanner = ({ showWelcomeBanner, isLoading, setShowWelcomeBanner }: WelcomeBannerProps) => {
  const { t } = useTranslate();

  return (
    <div className={"relative flex w-full flex-col gap-2 rounded-md"}>
      {showWelcomeBanner && !isLoading && (
        <div className="mb-2 flex items-center justify-between rounded-lg border border-slate-300 bg-slate-100 p-4">
          <div className="flex items-center gap-3">
            <InfoIcon className="h-5 w-5 text-slate-700" strokeWidth={2.5} />
            <p className="font-medium text-slate-500">
              {t(
                "environments.activity.banner.welcome_to_engage_hq_complete_your_first_task_to_earn_rewards"
              )}
            </p>
          </div>
          <button
            onClick={() => setShowWelcomeBanner(false)}
            className="hover:bg-accent inline-flex h-10 w-10 items-center justify-center rounded-md text-slate-500 hover:text-slate-700">
            <XIcon className="h-4 w-4" strokeWidth={2.5} />
          </button>
        </div>
      )}
    </div>
  );
};

export default WelcomeBanner;
