import Headline from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/components/Headline";
import { questionTypes } from "@/app/lib/questions";
import { InboxStackIcon } from "@heroicons/react/24/solid";
import Image from "next/image";
import { useMemo } from "react";

import { getLocalizedValue } from "@formbricks/lib/utils/i18n";
import type { TSurveyPictureSelectionQuestion, TSurveyQuestionSummary } from "@formbricks/types/surveys";
import { ProgressBar } from "@formbricks/ui/ProgressBar";

interface PictureChoiceSummaryProps {
  questionSummary: TSurveyQuestionSummary<TSurveyPictureSelectionQuestion>;
}

interface ChoiceResult {
  id: string;
  imageUrl: string;
  count: number;
  percentage?: number;
}

export default function PictureChoiceSummary({ questionSummary }: PictureChoiceSummaryProps) {
  const isMulti = questionSummary.question.allowMulti;
  const questionTypeInfo = questionTypes.find((type) => type.id === questionSummary.question.type);

  const results: ChoiceResult[] = useMemo(() => {
    if (!("choices" in questionSummary.question)) return [];

    // build a dictionary of choices
    const resultsDict: { [key: string]: ChoiceResult } = {};
    for (const choice of questionSummary.question.choices) {
      resultsDict[choice.id] = {
        id: choice.id,
        imageUrl: choice.imageUrl,
        count: 0,
        percentage: 0,
      };
    }

    // count the responses
    for (const response of questionSummary.responses) {
      if (Array.isArray(response.value)) {
        for (const choice of response.value) {
          if (choice in resultsDict) {
            resultsDict[choice].count += 1;
          }
        }
      }
    }

    // add the percentage
    const total = questionSummary.responses.length;
    for (const key of Object.keys(resultsDict)) {
      if (resultsDict[key].count) {
        resultsDict[key].percentage = resultsDict[key].count / total;
      }
    }

    // sort by count and transform to array
    const results = Object.values(resultsDict).sort((a, b) => {
      return b.count - a.count;
    });

    return results;
  }, [questionSummary]);

  const totalResponses = useMemo(() => {
    let total = 0;
    for (const result of results) {
      total += result.count;
    }
    return total;
  }, [results]);

  return (
    <div className=" rounded-lg border border-slate-200 bg-slate-50 shadow-sm">
      <div className="space-y-2 px-4 pb-5 pt-6 md:px-6">
        <Headline headline={getLocalizedValue(questionSummary.question.headline, "en")} />

        <div className="flex space-x-2 text-xs font-semibold text-slate-600 md:text-sm">
          <div className="flex items-center rounded-lg bg-slate-100 p-2">
            {questionTypeInfo && <questionTypeInfo.icon className="mr-2 h-4 w-4 " />}
            {questionTypeInfo ? questionTypeInfo.label : "Unknown Question Type"} Question
          </div>
          <div className="flex items-center rounded-lg bg-slate-100 p-2">
            <InboxStackIcon className="mr-2 h-4 w-4 " />
            {totalResponses} responses
          </div>
          <div className="flex items-center rounded-lg bg-slate-100 p-2">
            {isMulti ? "Multi" : "Single"} Select
          </div>
          {!questionSummary.question.required && (
            <div className="flex items-center  rounded-lg bg-slate-100 p-2">Optional</div>
          )}
        </div>
      </div>
      <div className="space-y-5 rounded-b-lg bg-white px-4 pb-6 pt-4 text-sm md:px-6 md:text-base">
        {results.map((result) => (
          <div key={result.id}>
            <div className="text flex flex-col justify-between px-2 pb-2 sm:flex-row">
              <div className="mr-8 flex w-full justify-between space-x-1 sm:justify-normal ">
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
                    {Math.round((result.percentage || 0) * 100)}%
                  </p>
                </div>
              </div>
              <p className="flex w-full pt-1 text-slate-600 sm:items-end sm:justify-end sm:pt-0">
                {result.count} {result.count === 1 ? "response" : "responses"}
              </p>
            </div>
            <ProgressBar barColor="bg-brand" progress={result.percentage || 0} />
          </div>
        ))}
      </div>
    </div>
  );
}
