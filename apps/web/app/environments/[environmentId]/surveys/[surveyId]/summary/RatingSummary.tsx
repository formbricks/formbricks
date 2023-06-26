import type { QuestionSummary } from "@formbricks/types/responses";
import { ProgressBar } from "@formbricks/ui";
import { InboxStackIcon } from "@heroicons/react/24/solid";
import { useMemo } from "react";
import { RatingResponse } from "../RatingResponse";
import { QuestionType, RatingQuestion } from "@formbricks/types/questions";

interface RatingSummaryProps {
  questionSummary: QuestionSummary<RatingQuestion>;
}

interface ChoiceResult {
  label: number | string;
  count: number;
  percentage: number;
}

export default function RatingSummary({ questionSummary }: RatingSummaryProps) {
  const results: ChoiceResult[] = useMemo(() => {
    if (questionSummary.question.type !== QuestionType.Rating) return [];
    // build a dictionary of choices
    const resultsDict: { [key: string]: ChoiceResult } = {};
    for (let i = 1; i <= questionSummary.question.range; i++) {
      resultsDict[i.toString()] = {
        count: 0,
        label: i,
        percentage: 0,
      };
    }
    // count the responses
    for (const response of questionSummary.responses) {
      // if single choice, only add responses that are in the choices
      if (!Array.isArray(response.value) && response.value in resultsDict) {
        resultsDict[response.value].count += 1;
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
    const results = Object.values(resultsDict).sort((a: any, b: any) => a.label - b.label);

    return results;
  }, [questionSummary]);

  const dismissed: ChoiceResult = useMemo(() => {
    if (questionSummary.question.required) return { count: 0, label: "Dismissed", percentage: 0 };

    const total = questionSummary.responses.length;
    let count = 0;
    for (const response of questionSummary.responses) {
      if (!response.value) {
        count += 1;
      }
    }
    return {
      count,
      label: "Dismissed",
      percentage: count / total,
    };
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
      <div className="space-y-2 px-6 pb-5 pt-6">
        <div>
          <h3 className="pb-1 text-xl font-semibold text-slate-900">{questionSummary.question.headline}</h3>
        </div>
        <div className="flex space-x-2 font-semibold text-slate-600">
          <div className="rounded-lg bg-slate-100 p-2 text-sm">Rating Question</div>
          <div className=" flex items-center rounded-lg bg-slate-100 p-2 text-sm">
            <InboxStackIcon className="mr-2 h-4 w-4 " />
            {totalResponses} responses
          </div>
        </div>
      </div>
      <div className="space-y-5 bg-white px-6 pb-6 pt-4">
        {results.map((result: any) => (
          <div key={result.label}>
            <div className="text flex justify-between px-2 pb-2">
              <div className="mr-8 flex space-x-1">
                <div className="font-semibold text-slate-700">
                  <RatingResponse
                    scale={questionSummary.question.scale}
                    answer={result.label}
                    range={questionSummary.question.range}
                  />
                </div>
                <div>
                  <p className="rounded-lg bg-slate-100 px-2 text-slate-700">
                    {Math.round(result.percentage * 100)}%
                  </p>
                </div>
              </div>
              <p className="flex w-32 items-end justify-end text-slate-600">
                {result.count} {result.count === 1 ? "response" : "responses"}
              </p>
            </div>
            <ProgressBar barColor="bg-brand" progress={result.percentage} />
          </div>
        ))}
      </div>
      {dismissed.count > 0 && (
        <div className="rounded-b-lg border-t bg-white px-6 pb-6 pt-4">
          <div key={dismissed.label}>
            <div className="text flex justify-between px-2 pb-2">
              <div className="mr-8 flex space-x-1">
                <p className="font-semibold text-slate-700">{dismissed.label}</p>
                <div>
                  <p className="rounded-lg bg-slate-100 px-2 text-slate-700">
                    {Math.round(dismissed.percentage * 100)}%
                  </p>
                </div>
              </div>
              <p className="flex w-32 items-end justify-end text-slate-600">
                {dismissed.count} {dismissed.count === 1 ? "response" : "responses"}
              </p>
            </div>
            <ProgressBar barColor="bg-slate-600" progress={dismissed.percentage} />
          </div>
        </div>
      )}
    </div>
  );
}
