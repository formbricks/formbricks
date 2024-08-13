import Image from "next/image";
import { TAttributeClass } from "@formbricks/types/attribute-classes";
import {
  TI18nString,
  TSurvey,
  TSurveyQuestionSummaryPictureSelection,
  TSurveyQuestionTypeEnum,
} from "@formbricks/types/surveys/types";
import { ProgressBar } from "@formbricks/ui/ProgressBar";
import { convertFloatToNDecimal } from "../lib/utils";
import { QuestionSummaryHeader } from "./QuestionSummaryHeader";

interface PictureChoiceSummaryProps {
  questionSummary: TSurveyQuestionSummaryPictureSelection;
  survey: TSurvey;
  attributeClasses: TAttributeClass[];
  setFilter: (
    questionId: string,
    label: TI18nString,
    questionType: TSurveyQuestionTypeEnum,
    filterValue: string,
    filterComboBoxValue?: string | string[]
  ) => void;
}

export const PictureChoiceSummary = ({
  questionSummary,
  survey,
  attributeClasses,
  setFilter,
}: PictureChoiceSummaryProps) => {
  const results = questionSummary.choices;

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <QuestionSummaryHeader
        questionSummary={questionSummary}
        survey={survey}
        attributeClasses={attributeClasses}
      />
      <div className="space-y-5 px-4 pb-6 pt-4 text-sm md:px-6 md:text-base">
        {results.map((result, index) => (
          <div
            className="cursor-pointer hover:opacity-80"
            key={result.id}
            onClick={() =>
              setFilter(
                questionSummary.question.id,
                questionSummary.question.headline,
                questionSummary.question.type,
                "Includes all",
                [`Picture ${index + 1}`]
              )
            }>
            <div className="text flex flex-col justify-between px-2 pb-2 sm:flex-row">
              <div className="mr-8 flex w-full justify-between space-x-1 sm:justify-normal">
                <div className="relative h-32 w-[220px]">
                  <Image
                    src={result.imageUrl}
                    alt="choice-image"
                    layout="fill"
                    objectFit="cover"
                    className="rounded-md"
                  />
                </div>
                <div className="self-end">
                  <p className="rounded-lg bg-slate-100 px-2 text-slate-700">
                    {convertFloatToNDecimal(result.percentage, 1)}%
                  </p>
                </div>
              </div>
              <p className="flex w-full pt-1 text-slate-600 sm:items-end sm:justify-end sm:pt-0">
                {result.count} {result.count === 1 ? "response" : "responses"}
              </p>
            </div>
            <ProgressBar barColor="bg-brand-dark" progress={result.percentage / 100 || 0} />
          </div>
        ))}
      </div>
    </div>
  );
};
