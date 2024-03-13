import Headline from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/components/Headline";
import { questionTypes } from "@/app/lib/questions";
import { CircleSlash2, InboxIcon, SmileIcon, StarIcon } from "lucide-react";
import { useMemo } from "react";

import { TSurveySummaryRating } from "@formbricks/types/responses";
import { ProgressBar } from "@formbricks/ui/ProgressBar";
import { RatingResponse } from "@formbricks/ui/RatingResponse";

interface RatingSummaryProps {
  questionSummary: TSurveySummaryRating;
}

export default function RatingSummary({ questionSummary }: RatingSummaryProps) {
  const questionTypeInfo = questionTypes.find((type) => type.id === questionSummary.question.type);

  const getIconBasedOnScale = useMemo(() => {
    const scale = questionSummary.question.scale;
    if (scale === "number") return <CircleSlash2 className="h-4 w-4" />;
    else if (scale === "star") return <StarIcon fill="rgb(250 204 21)" className="h-4 w-4 text-yellow-400" />;
    else if (scale === "smiley") return <SmileIcon className="h-4 w-4" />;
  }, [questionSummary]);

  return (
    <div className=" rounded-lg border border-slate-200 bg-slate-50 shadow-sm">
      <div className="space-y-2 px-4 pb-5 pt-6 md:px-6">
        <Headline headline={questionSummary.question.headline} />

        <div className="flex space-x-2 text-xs font-semibold text-slate-600 md:text-sm">
          <div className="flex items-center rounded-lg bg-slate-100 p-2">
            {questionTypeInfo && <questionTypeInfo.icon className="mr-2 h-4 w-4 " />}
            {questionTypeInfo ? questionTypeInfo.label : "Unknown Question Type"} Question
          </div>
          <div className="flex items-center rounded-lg bg-slate-100 p-2">
            <InboxIcon className="mr-2 h-4 w-4 " />
            {questionSummary.responseCount} responses
          </div>
          <div className="flex items-center space-x-2 rounded-lg bg-slate-100 p-2">
            {getIconBasedOnScale}
            <div>Overall: {questionSummary.average.toFixed(2)}</div>
          </div>
          {!questionSummary.question.required && (
            <div className="flex items-center  rounded-lg bg-slate-100 p-2">Optional</div>
          )}
        </div>
      </div>
      <div className="space-y-5 rounded-b-lg bg-white px-4 pb-6 pt-4 text-sm md:px-6 md:text-base">
        {questionSummary.choices.map((result) => (
          <div key={result.rating}>
            <div className="text flex justify-between px-2 pb-2">
              <div className="mr-8 flex items-center space-x-1">
                <div className="font-semibold text-slate-700">
                  <RatingResponse
                    scale={questionSummary.question.scale}
                    answer={result.rating}
                    range={questionSummary.question.range}
                  />
                </div>
                <div>
                  <p className="rounded-lg bg-slate-100 px-2 text-slate-700">
                    {Math.round(result.percentage)}%
                  </p>
                </div>
              </div>
              <p className="flex w-32 items-end justify-end text-slate-600">
                {result.count} {result.count === 1 ? "response" : "responses"}
              </p>
            </div>
            <ProgressBar barColor="bg-brand" progress={result.percentage / 100} />
          </div>
        ))}
      </div>
      {questionSummary.dismissed && questionSummary.dismissed.count > 0 && (
        <div className="rounded-b-lg border-t bg-white px-6 pb-6 pt-4">
          <div key="dismissed">
            <div className="text flex justify-between px-2 pb-2">
              <div className="mr-8 flex space-x-1">
                <p className="font-semibold text-slate-700">dismissed</p>
                <div>
                  <p className="rounded-lg bg-slate-100 px-2 text-slate-700">
                    {Math.round(questionSummary.dismissed.percentage)}%
                  </p>
                </div>
              </div>
              <p className="flex w-32 items-end justify-end text-slate-600">
                {questionSummary.dismissed.count}{" "}
                {questionSummary.dismissed.count === 1 ? "response" : "responses"}
              </p>
            </div>
            <ProgressBar barColor="bg-slate-600" progress={questionSummary.dismissed.percentage / 100} />
          </div>
        </div>
      )}
    </div>
  );
}
