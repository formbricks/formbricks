import { Badge } from "@/modules/ui/components/badge";
import { Button } from "@/modules/ui/components/button";
import { useTranslate } from "@tolgee/react";
import { formatDistance } from "date-fns";
import { ArrowRightIcon } from "lucide-react";
import { Clock } from "lucide-react";
import { TSurvey } from "@formbricks/types/surveys/types";

interface ActiveSurveyCardProps {
  survey: TSurvey;
  type: String;
}

export const ActiveSurveyCard = ({ survey }: ActiveSurveyCardProps) => {
  const { t } = useTranslate();

  const surveyTypeLabel = t("common.engagement");

  return (
    <div className="relative my-4 flex w-full flex-col rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="min-h-[170px] p-6">
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
          <p className="mb-1 line-clamp-1 text-lg font-medium">{survey.name}</p>
          <p className="mb-4 line-clamp-2 text-sm text-slate-500">{survey.description}</p>
        </div>
      </div>
      <div className="flex items-center p-6 pt-0">
        <Button
          onClick={() => (window.location.href = `/s/${survey.id}`)}
          className="ring-offset-background focus-visible:ring-ring group inline-flex h-10 w-full items-center justify-center gap-2 whitespace-nowrap rounded-md px-4 py-2 text-sm transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
          type="submit"
          loading={false}>
          {t("environments.activity.card.start_survey")}
          <ArrowRightIcon
            className="ml-2 h-4 w-4 transition-transform duration-300 group-hover:translate-x-1"
            strokeWidth={3}
          />
        </Button>
      </div>
    </div>
  );
};
