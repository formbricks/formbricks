import { ProgressBar } from "@formbricks/ui";
import type { QuestionSummary } from "@formbricks/types/responses";
import { InboxStackIcon } from "@heroicons/react/24/solid";
import { useMemo } from "react";
import { HalfCircle } from "@/../../packages/ui/components/ProgressBar";

interface NPSSummaryProps {
  questionSummary: QuestionSummary;
}

interface Result {
  promoters: number;
  passives: number;
  detractors: number;
  total: number;
  score: number;
}

export default function NPSSummary({ questionSummary }: NPSSummaryProps) {
  const percentage = (count, total) => {
    const result = count / total;
    return result || 0;
  };

  const result: Result = useMemo(() => {
    let data = {
      promoters: 0,
      passives: 0,
      detractors: 0,
      total: 0,
      score: 0,
    };

    for (let response of questionSummary.responses) {
      const value = response.value;
      if (typeof value !== "number") continue;

      data.total++;
      if (value >= 9) {
        data.promoters++;
      } else if (value >= 7) {
        data.passives++;
      } else {
        data.detractors++;
      }
    }

    data.score = (percentage(data.promoters, data.total) - percentage(data.detractors, data.total)) * 100;
    return data;
  }, [questionSummary]);

  return (
    <div className=" rounded-lg border border-slate-200 bg-slate-50 shadow-sm">
      <div className="space-y-2 px-6 pb-5 pt-6">
        <div>
          <h3 className="pb-1 text-xl font-semibold text-slate-900">{questionSummary.question.headline}</h3>
        </div>
        <div className="flex space-x-2 font-semibold text-slate-600">
          <div className="rounded-lg bg-slate-100 p-2 text-sm">Net Promoter Score (NPS)</div>
          <div className=" flex items-center rounded-lg bg-slate-100 p-2 text-sm">
            <InboxStackIcon className="mr-2 h-4 w-4 " />
            {result.total} responses
          </div>
        </div>
      </div>
      <div className="space-y-5 rounded-b-lg bg-white px-6 pb-6 pt-4">
        {["promoters", "passives", "detractors"].map((group) => (
          <div key={group}>
            <div className="mb-2 flex justify-between">
              <div className="mr-8 flex space-x-1">
                <p className="font-semibold capitalize text-slate-700">{group}</p>
                <div>
                  <p className="rounded-lg bg-slate-100 px-2 text-slate-700">
                    {Math.round(percentage(result[group], result.total) * 100)}%
                  </p>
                </div>
              </div>
              <p className="flex w-32 items-end justify-end text-slate-600">
                {result[group]} {result[group] === 1 ? "response" : "responses"}
              </p>
            </div>
            <ProgressBar barColor="bg-brand" progress={percentage(result[group], result.total)} />
          </div>
        ))}
      </div>
      <div className="mb-4 mt-4 flex justify-center">
        <HalfCircle value={result.score} />
      </div>
    </div>
  );
}
