import { Badge } from "@/modules/ui/components/badge";
import { Button } from "@/modules/ui/components/button";
import { Survey } from "@prisma/client";
import { useTranslate } from "@tolgee/react";
import { ArrowRightIcon } from "lucide-react";

interface SurveyCardProps {
  survey: Survey;
  type: String;
}

export const SurveyCard = ({ survey, type }: SurveyCardProps) => {
  const { t } = useTranslate();

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
    <div className="relative my-4 flex w-full flex-col gap-2 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-2 flex w-full flex-row justify-between">
        <div className="">
          <Badge size="tiny" type="gray" text={surveyTypeLabel} />
        </div>
      </div>
      <p className="mb-2 text-lg font-medium">{survey.name}</p>
      <Button
        onClick={() => (window.location.href = `/s/${survey.id}`)}
        className="ring-offset-background focus-visible:ring-ring group inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
        type="submit"
        loading={false}>
        {t("environments.activity.card.start_survey")}
        <ArrowRightIcon
          className="ml-2 h-4 w-4 transition-transform duration-300 group-hover:translate-x-1"
          strokeWidth={2}
        />
      </Button>
    </div>
  );
};
