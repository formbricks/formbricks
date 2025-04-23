// import { SurveyInfoModal } from "@/modules/activity/components/common/survey-info-modal";
import { Badge } from "@/modules/ui/components/badge";
import { Button } from "@/modules/ui/components/button";
import { useTranslate } from "@tolgee/react";
import { formatDistance } from "date-fns";
import { ArrowRightIcon, Clock, Sparkles } from "lucide-react";
// import { useState } from "react";
import { TSurvey } from "@formbricks/types/surveys/types";

interface CompletedSurveyCardProps {
  survey: TSurvey;
  type: String;
}

export const CompletedSurveyCard = ({ survey, type }: CompletedSurveyCardProps) => {
  const { t } = useTranslate();
  // const [isModalOpen, setIsModalOpen] = useState(false);

  const surveyTypeLabel = (() => {
    switch (type) {
      case "survey":
        return t("common.survey");
      case "quest":
        return t("common.quest");
      default:
        return t("common.survey");
    }
  })();

  return (
    <div className="relative my-4 flex w-full flex-col rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="p-6">
        <div className="mb-2 flex w-full flex-row items-center justify-between">
          <div>
            <Badge size="tiny" type="gray" text={surveyTypeLabel} />
          </div>

          {survey.closeOnDate && (
            <div className="mt-1 flex items-center text-xs text-slate-500">
              <Clock className="mr-1 h-4 w-4" strokeWidth={1.5} />
              {formatDistance(new Date(survey.closeOnDate), new Date(), { addSuffix: false })}
            </div>
          )}
        </div>
        <div className="flex-1">
          <p className="mb-1 text-lg font-medium">{survey.name}</p>
          <p className="mb-4 text-sm text-slate-500">{survey.description}</p>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 text-blue-400">
            <Sparkles className="h-4 w-4" strokeWidth={1.5} />
            <span className="font-bold">5 USDC</span>
          </div>
          <div className="flex items-center gap-2">
            <a className="flex items-center hover:underline" href="/communities/wonder">
              <span className="relative mr-1 flex h-5 w-5 shrink-0 overflow-hidden rounded-md">
                <div className="mx-auto w-80 bg-slate-500" />
              </span>
              <span className="text-xs text-slate-500">Wonder Protocol</span>
            </a>
          </div>
        </div>
      </div>
      <div className="flex items-center p-6 pt-0">
        <Button
          // onClick={() => setIsModalOpen(true)}
          className="ring-offset-background focus-visible:ring-ring group inline-flex h-10 w-full items-center justify-center gap-2 whitespace-nowrap rounded-md px-4 py-2 text-sm transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
          type="submit"
          loading={false}>
          {t("environments.activity.card.view_info")}
          <ArrowRightIcon
            className="ml-2 h-4 w-4 transition-transform duration-300 group-hover:translate-x-1"
            strokeWidth={3}
          />
        </Button>
        {/* <SurveyInfoModal survey={survey} open={isModalOpen} setOpen={setIsModalOpen} /> */}
      </div>
    </div>
  );
};
