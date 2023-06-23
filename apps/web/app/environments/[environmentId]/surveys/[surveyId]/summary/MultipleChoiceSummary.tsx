import {
  MultipleChoiceMultiQuestion,
  MultipleChoiceSingleQuestion,
  QuestionType,
} from "@formbricks/types/questions";
import type { QuestionSummary } from "@formbricks/types/responses";
import { PersonAvatar, ProgressBar } from "@formbricks/ui";
import { InboxStackIcon } from "@heroicons/react/24/solid";
import { useMemo } from "react";
import Link from "next/link";
import { truncate } from "@/lib/utils";

interface MultipleChoiceSummaryProps {
  questionSummary: QuestionSummary<MultipleChoiceMultiQuestion | MultipleChoiceSingleQuestion>;
  environmentId: string;
  surveyType: string;
}

interface ChoiceResult {
  id: string;
  label: string;
  count: number;
  percentage?: number;
  otherValues?: {
    value: string;
    person: {
      id: string;
      name?: string;
      email?: string;
    };
  }[];
}

export default function MultipleChoiceSummary({
  questionSummary,
  environmentId,
  surveyType,
}: MultipleChoiceSummaryProps) {
  const isSingleChoice = questionSummary.question.type === QuestionType.MultipleChoiceSingle;

  const results: ChoiceResult[] = useMemo(() => {
    if (!("choices" in questionSummary.question)) return [];

    // build a dictionary of choices
    const resultsDict: { [key: string]: ChoiceResult } = {};
    for (const choice of questionSummary.question.choices) {
      resultsDict[choice.label] = {
        id: choice.id,
        label: choice.label,
        count: 0,
        percentage: 0,
        otherValues: [],
      };
    }

    function findEmail(person) {
      const emailAttribute = person.attributes.email;
      return emailAttribute ? emailAttribute.value : null;
    }

    const addOtherChoice = (response, value) => {
      for (const key in resultsDict) {
        if (resultsDict[key].id === "other" && value !== "") {
          const email = response.person && findEmail(response.person);
          const displayIdentifier = email || truncate(response.personId, 16);
          resultsDict[key].otherValues?.push({
            value,
            person: {
              id: response.personId,
              email: displayIdentifier,
            },
          });
          resultsDict[key].count += 1;
          break;
        }
      }
    };

    // count the responses
    for (const response of questionSummary.responses) {
      // if single choice, only add responses that are in the choices
      if (isSingleChoice && response.value.toString() in resultsDict) {
        resultsDict[response.value.toString()].count += 1;
      } else if (isSingleChoice) {
        // if single choice and not in choices, add to other
        addOtherChoice(response, response.value);
      } else if (Array.isArray(response.value)) {
        // if multi choice add all responses
        for (const choice of response.value) {
          if (choice in resultsDict) {
            resultsDict[choice].count += 1;
          } else {
            // if multi choice and not in choices, add to other
            addOtherChoice(response, choice);
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
    const results = Object.values(resultsDict).sort((a: any, b: any) => {
      if (a.id === "other") return 1; // Always put a after b if a's id is 'other'
      if (b.id === "other") return -1; // Always put b after a if b's id is 'other'

      // If neither id is 'other', compare counts
      return b.count - a.count;
    });
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
            {result.otherValues.length > 0 && (
              <div className="mt-4 rounded-lg border border-slate-200">
                <div className="grid h-12 grid-cols-2 content-center rounded-t-lg bg-slate-100 text-left text-sm font-semibold text-slate-900">
                  <div className="col-span-1 pl-6 ">Specified &quot;Other&quot; answers</div>
                  <div className="col-span-1 pl-6 ">{surveyType === "web" && "User"}</div>
                </div>
                {result.otherValues
                  .filter((otherValue) => otherValue !== "")
                  .map((otherValue, idx) => (
                    <div key={idx}>
                      {surveyType === "link" && (
                        <div
                          key={idx}
                          className="ph-no-capture col-span-1 m-2 flex h-10 items-center rounded-lg pl-4 text-sm font-medium text-slate-900">
                          <span>{otherValue.value}</span>
                        </div>
                      )}
                      {surveyType === "web" && (
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
                            <span>{otherValue.person.email}</span>
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
