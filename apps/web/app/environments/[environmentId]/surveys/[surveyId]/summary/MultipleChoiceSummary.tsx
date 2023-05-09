import type { QuestionSummary } from "@formbricks/types/responses";
import { ProgressBar } from "@formbricks/ui";
import { InboxStackIcon } from "@heroicons/react/24/solid";
import { useMemo } from "react";

interface MultipleChoiceSummaryProps {
  questionSummary: QuestionSummary;
}

interface ChoiceResult {
  label: string;
  count: number;
  percentage?: number;
}

export default function MultipleChoiceSummary({ questionSummary }: MultipleChoiceSummaryProps) {
  const isSingleChoice = questionSummary.question.type === "multipleChoiceSingle";

  const results: ChoiceResult[] = useMemo(() => {
    if (!("choices" in questionSummary.question)) return [];
    // build a dictionary of choices
    const resultsDict: { [key: string]: ChoiceResult } = {};
    for (const choice of questionSummary.question.choices) {
      resultsDict[choice.label] = {
        count: 0,
        label: choice.label,
        percentage: 0,
      };
    }
    // count the responses
    for (const response of questionSummary.responses) {
      // if single choice, only add responses that are in the choices
      if (isSingleChoice && response.value in resultsDict) {
        resultsDict[response.value].count += 1;
      } else {
        // if multi choice add all responses
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
    const results = Object.values(resultsDict).sort((a: any, b: any) => b.count - a.count);
    return results;
  }, [questionSummary, isSingleChoice]);

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
          <div className="rounded-lg bg-slate-100 p-2 text-sm">
            {isSingleChoice
              ? "Multiple-Choice Single Select Question"
              : "Multiple-Choice Multi Select Question"}
          </div>
          <div className=" flex items-center rounded-lg bg-slate-100 p-2 text-sm">
            <InboxStackIcon className="mr-2 h-4 w-4 " />
            {totalResponses} responses
          </div>
          {/*           <div className=" flex items-center rounded-lg bg-slate-100 p-2">
            <ArrowTrendingUpIcon className="mr-2 h-4 w-4" />
            2.8 average
          </div> */}
        </div>
      </div>
      <div className="space-y-5 rounded-b-lg bg-white px-6 pb-6 pt-4">
        {results.map((result: any, resultsIdx) => (
          <div key={result.label}>
            <div className="text flex justify-between px-2 pb-2">
              <div className="mr-8 flex space-x-1">
                <p className="font-semibold text-slate-700">
                  {results.length - resultsIdx} - {result.label}
                </p>
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
    </div>
  );
}
