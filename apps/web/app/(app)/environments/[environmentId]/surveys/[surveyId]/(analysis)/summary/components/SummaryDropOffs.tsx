import { QuestionSummary } from "@formbricks/types/responses";
import { TSurveyQuestion } from "@formbricks/types/v1/surveys";
import { useMemo } from "react";

interface SummaryDropOffsProps {
  summaryData: QuestionSummary<TSurveyQuestion>[];
}

export default function SummaryDropOffs({ summaryData }: SummaryDropOffsProps) {
  const dropoff = useMemo(() => {
    const values: { drop: number; percentage?: number }[] = [];
    for (let i = 0; i < summaryData.length; i++) {
      if (i === summaryData.length - 1) values.push({ drop: 0, percentage: 0 });
      else {
        const curr = summaryData[i].responses.length;
        const next = summaryData[i + 1].responses.length;
        const drop = next - curr;

        if (drop === 0) values.push({ drop: 0, percentage: 0 });
        else if (curr === 0) values.push({ drop: drop });
        else {
          const absDrop = Math.abs(drop);
          const percentage = (absDrop / curr) * 100;
          if (percentage % 1 !== 0) values.push({ drop: drop, percentage: Number(percentage.toFixed(2)) });
          else values.push({ drop, percentage: percentage });
        }
      }
    }

    return values;
  }, [summaryData]);

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 shadow-sm">
      <div className="rounded-b-lg bg-white ">
        <div className="grid h-10 grid-cols-5 items-center border-y border-slate-200 bg-slate-100 text-sm font-bold text-slate-600">
          <div className="col-span-3 pl-4 md:pl-6">Questions</div>
          <div className="pl-4 text-center md:pl-6">Views</div>
          <div className="px-4 text-center md:px-6">Drop-off</div>
        </div>
        {summaryData.map((questionSummary, i) => (
          <div
            key={questionSummary.question.id}
            className="grid grid-cols-5 items-center border-b border-slate-100 py-2 text-sm text-slate-800 md:text-base">
            <div className="col-span-3 pl-4 md:pl-6">{questionSummary.question.headline}</div>
            <div className="whitespace-pre-wrap pl-6 text-center font-semibold">
              {questionSummary.responses.length}
            </div>
            <div className="px-4 text-center md:px-6">
              <span className="font-semibold">{dropoff[i].drop} </span>
              {dropoff[i].percentage ? <span>({dropoff[i].percentage}%)</span> : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
