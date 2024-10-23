import { TAttributeClass } from "@formbricks/types/attribute-classes";
import {
  TI18nString,
  TSurvey,
  TSurveyQuestionId,
  TSurveyQuestionSummaryNps,
  TSurveyQuestionTypeEnum,
} from "@formbricks/types/surveys/types";
import { HalfCircle, ProgressBar } from "@formbricks/ui/components/ProgressBar";
import { convertFloatToNDecimal } from "../lib/utils";
import { QuestionSummaryHeader } from "./QuestionSummaryHeader";

interface NPSSummaryProps {
  questionSummary: TSurveyQuestionSummaryNps;
  survey: TSurvey;
  attributeClasses: TAttributeClass[];
  setFilter: (
    questionId: TSurveyQuestionId,
    label: TI18nString,
    questionType: TSurveyQuestionTypeEnum,
    filterValue: string,
    filterComboBoxValue?: string | string[]
  ) => void;
}

export const NPSSummary = ({ questionSummary, survey, attributeClasses, setFilter }: NPSSummaryProps) => {
  const applyFilter = (group: string) => {
    const filters = {
      promoters: {
        comparison: "Includes either",
        values: ["9", "10"],
      },
      passives: {
        comparison: "Includes either",
        values: ["7", "8"],
      },
      detractors: {
        comparison: "Is less than",
        values: "7",
      },
      dismissed: {
        comparison: "Skipped",
        values: undefined,
      },
    };

    const filter = filters[group];

    if (filter) {
      setFilter(
        questionSummary.question.id,
        questionSummary.question.headline,
        questionSummary.question.type,
        filter.comparison,
        filter.values
      );
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <QuestionSummaryHeader
        questionSummary={questionSummary}
        survey={survey}
        attributeClasses={attributeClasses}
      />
      <div className="space-y-5 px-4 pb-6 pt-4 text-sm md:px-6 md:text-base">
        {["promoters", "passives", "detractors", "dismissed"].map((group) => (
          <div className="cursor-pointer hover:opacity-80" key={group} onClick={() => applyFilter(group)}>
            <div
              className={`mb-2 flex justify-between ${group === "dismissed" ? "mb-2 border-t bg-white pt-4 text-sm md:text-base" : ""}`}>
              <div className="mr-8 flex space-x-1">
                <p
                  className={`font-semibold capitalize text-slate-700 ${group === "dismissed" ? "" : "text-slate-700"}`}>
                  {group}
                </p>
                <div>
                  <p className="rounded-lg bg-slate-100 px-2 text-slate-700">
                    {convertFloatToNDecimal(questionSummary[group]?.percentage, 1)}%
                  </p>
                </div>
              </div>
              <p className="flex w-32 items-end justify-end text-slate-600">
                {questionSummary[group]?.count}{" "}
                {questionSummary[group]?.count === 1 ? "response" : "responses"}
              </p>
            </div>
            <ProgressBar
              barColor={group === "dismissed" ? "bg-slate-600" : "bg-brand-dark"}
              progress={questionSummary[group]?.percentage / 100}
            />
          </div>
        ))}
      </div>

      <div className="flex justify-center pb-4 pt-4">
        <HalfCircle value={questionSummary.score} />
      </div>
    </div>
  );
};
