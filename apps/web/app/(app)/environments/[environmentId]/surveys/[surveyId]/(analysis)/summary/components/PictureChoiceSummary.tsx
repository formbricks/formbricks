import Headline from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/components/Headline";
import { questionTypes } from "@/app/lib/questions";
import { InboxIcon } from "lucide-react";
import Image from "next/image";

import { TSurveySummaryPictureSelection } from "@formbricks/types/responses";
import { ProgressBar } from "@formbricks/ui/ProgressBar";

interface PictureChoiceSummaryProps {
  questionSummary: TSurveySummaryPictureSelection;
}

export default function PictureChoiceSummary({ questionSummary }: PictureChoiceSummaryProps) {
  const isMulti = questionSummary.question.allowMulti;
  const questionTypeInfo = questionTypes.find((type) => type.id === questionSummary.question.type);

  const results = questionSummary.choices.sort((a, b) => b.count - a.count);

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
                    {Math.round(result.percentage)}%
                  </p>
                </div>
              </div>
              <p className="flex w-full pt-1 text-slate-600 sm:items-end sm:justify-end sm:pt-0">
                {result.count} {result.count === 1 ? "response" : "responses"}
              </p>
            </div>
            <ProgressBar barColor="bg-brand" progress={result.percentage / 100 || 0} />
          </div>
        ))}
      </div>
    </div>
  );
}
