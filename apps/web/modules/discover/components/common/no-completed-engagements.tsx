import { useTranslate } from "@tolgee/react";
import { SparkleIcon } from "lucide-react";

interface NoCompletedEngagementsProps {
  border?: boolean;
  setActiveTab?: (id: string) => void;
}

export const NoCompletedEngagements = ({ border = true, setActiveTab }: NoCompletedEngagementsProps) => {
  const { t } = useTranslate();

  return (
    <div
      className={`col-span-full flex flex-col items-center justify-center rounded-lg ${border ? "border border-slate-200 bg-slate-50" : ""} px-4 py-12 text-center`}>
      <div className="mb-4 rounded-full bg-slate-100 p-3">
        <SparkleIcon className="h-8 w-8 text-slate-400" strokeWidth={1.5} />
      </div>
      <h3 className="mb-1 text-lg font-semibold text-slate-900">
        {t("environments.activity.card.no_completed_engagements")}
      </h3>
      <p className="mb-4 text-sm text-slate-500">
        {t("environments.activity.card.complete_your_first_engagement_to_earn_rewards")}
      </p>

      {setActiveTab && (
        <button
          onClick={() => setActiveTab("available-surveys")}
          className="bg-primary hover:bg-primary/90 inline-flex h-10 items-center justify-center rounded-md px-4 py-2 text-sm font-medium text-white">
          {t("environments.activity.card.find_engagement")}
        </button>
      )}
    </div>
  );
};
