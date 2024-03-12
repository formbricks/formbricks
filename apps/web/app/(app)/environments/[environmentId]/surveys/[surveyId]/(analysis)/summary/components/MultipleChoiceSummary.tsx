import Headline from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/components/Headline";
import { questionTypes } from "@/app/lib/questions";
import { InboxIcon } from "lucide-react";
import Link from "next/link";

import { getPersonIdentifier } from "@formbricks/lib/person/util";
import { TSurveySummaryMultipleChoice } from "@formbricks/types/responses";
import { PersonAvatar } from "@formbricks/ui/Avatars";
import { ProgressBar } from "@formbricks/ui/ProgressBar";

interface MultipleChoiceSummaryProps {
  questionSummary: TSurveySummaryMultipleChoice;
  environmentId: string;
  surveyType: string;
}

export default function MultipleChoiceSummary({
  questionSummary,
  environmentId,
  surveyType,
}: MultipleChoiceSummaryProps) {
  const questionTypeInfo = questionTypes.find((type) => type.id === questionSummary.question.type);

  // sort by count and transform to array
  const results = Object.values(questionSummary.choices).sort((a, b) => {
    if (a.others) return 1; // Always put a after b if a has 'others'
    if (b.others) return -1; // Always put b after a if b has 'others'

    // Sort by count
    return b.count - a.count;
  });

  return (
    <div className=" rounded-lg border border-slate-200 bg-slate-50 shadow-sm">
      <div className="space-y-2 px-4 pb-5 pt-6 md:px-6">
        <Headline headline={questionSummary.question.headline} />

        <div className="flex space-x-2 text-xs font-semibold text-slate-600 md:text-sm">
          <div className="flex items-center rounded-lg bg-slate-100 p-2">
            {questionTypeInfo && <questionTypeInfo.icon className="mr-2 h-4 w-4 " />}
            Multiple-Choice {questionTypeInfo ? questionTypeInfo.label : "Unknown Question Type"} Question
          </div>
          <div className="flex items-center rounded-lg bg-slate-100 p-2">
            <InboxIcon className="mr-2 h-4 w-4 " />
            {questionSummary.responseCount} responses
          </div>
          {!questionSummary.question.required && (
            <div className="flex items-center  rounded-lg bg-slate-100 p-2">Optional</div>
          )}
          {/*           <div className=" flex items-center rounded-lg bg-slate-100 p-2">
            <ArrowTrendingUpIcon className="mr-2 h-4 w-4" />
            2.8 average
          </div> */}
        </div>
      </div>
      <div className="space-y-5 rounded-b-lg bg-white px-4 pb-6 pt-4 text-sm md:px-6 md:text-base">
        {results.map((result, resultsIdx) => (
          <div key={result.value}>
            <div className="text flex flex-col justify-between px-2 pb-2 sm:flex-row">
              <div className="mr-8 flex w-full justify-between space-x-1 sm:justify-normal">
                <p className="font-semibold text-slate-700">
                  {results.length - resultsIdx} - {result.value}
                </p>
                <div>
                  <p className="rounded-lg bg-slate-100 px-2 text-slate-700">
                    {Math.round(result.percentage)}%
                  </p>
                </div>
              </div>
              <p className="flex w-full pt-1 text-slate-600 sm:items-end sm:justify-end sm:pt-0">
                {result.count} {result.count === 1 ? "response" : "responses"}
              </p>
            </div>
            <ProgressBar barColor="bg-brand" progress={result.percentage / 100} />
            {result.others && result.others.length > 0 && (
              <div className="mt-4 rounded-lg border border-slate-200">
                <div className="grid h-12 grid-cols-2 content-center rounded-t-lg bg-slate-100 text-left text-sm font-semibold text-slate-900">
                  <div className="col-span-1 pl-6 ">Specified &quot;Other&quot; answers</div>
                  <div className="col-span-1 pl-6 ">{surveyType === "web" && "User"}</div>
                </div>
                {result.others
                  .filter((otherValue) => otherValue.value !== "")
                  .map((otherValue, idx) => (
                    <div key={idx}>
                      {surveyType === "link" && (
                        <div
                          key={idx}
                          className="ph-no-capture col-span-1 m-2 flex h-10 items-center rounded-lg pl-4 text-sm font-medium text-slate-900">
                          <span>{otherValue.value}</span>
                        </div>
                      )}
                      {surveyType === "web" && otherValue.person && (
                        <Link
                          href={
                            otherValue.person.id
                              ? `/environments/${environmentId}/people/${otherValue.person.id}`
                              : { pathname: null }
                          }
                          key={idx}
                          className="m-2 grid h-16 grid-cols-2 items-center rounded-lg text-sm hover:bg-slate-100">
                          <div className="ph-no-capture col-span-1 pl-4 font-medium text-slate-900">
                            <span>{otherValue.value}</span>
                          </div>
                          <div className="ph-no-capture col-span-1 flex items-center space-x-4 pl-6 font-medium text-slate-900">
                            {otherValue.person.id && <PersonAvatar personId={otherValue.person.id} />}
                            <span>{getPersonIdentifier(otherValue.person)}</span>
                          </div>
                        </Link>
                      )}
                    </div>
                  ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
