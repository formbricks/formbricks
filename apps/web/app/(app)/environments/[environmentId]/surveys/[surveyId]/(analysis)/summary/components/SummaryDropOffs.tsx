import { evaluateCondition } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/components/evaluateLogic";
import { TResponse } from "@formbricks/types/v1/responses";
import { TSurvey } from "@formbricks/types/v1/surveys";
import { useMemo } from "react";

interface SummaryDropOffsProps {
  survey: TSurvey;
  responses: TResponse[];
  displayCount: number;
}

export default function SummaryDropOffs({ responses, survey, displayCount }: SummaryDropOffsProps) {
  const getDropoff = () => {
    let dropoffArr = new Array(survey.questions.length).fill(0);
    let viewsArr = new Array(survey.questions.length).fill(0);
    let dropoffPercentageArr = new Array(survey.questions.length).fill(0);

    responses.forEach((response) => {
      let currQuesIdx = 0;

      while (currQuesIdx < survey.questions.length) {
        const currQues = survey.questions[currQuesIdx];

        if (!currQues.required) {
          if (!response.data[currQues.id]) {
            viewsArr[currQuesIdx]++;

            const questionHasCustomLogic = currQues.logic;
            if (questionHasCustomLogic) {
              for (let logic of questionHasCustomLogic) {
                if (!logic.destination) continue;
                if (evaluateCondition(logic, response.data[currQues.id])) {
                  currQuesIdx = survey.questions.findIndex((q) => q.id === logic.destination);
                  break;
                }
              }
            } else {
              currQuesIdx++;
            }
            continue;
          }
        }

        if (
          (response.data[currQues.id] === undefined && !response.finished) ||
          (currQues.required && !response.data[currQues.id])
        ) {
          dropoffArr[currQuesIdx]++;
          viewsArr[currQuesIdx]++;
          break;
        }

        viewsArr[currQuesIdx]++;

        let nextQuesIdx = currQuesIdx + 1;
        const questionHasCustomLogic = currQues.logic;

        if (questionHasCustomLogic) {
          for (let logic of questionHasCustomLogic) {
            if (!logic.destination) continue;
            if (evaluateCondition(logic, response.data[currQues.id])) {
              nextQuesIdx = survey.questions.findIndex((q) => q.id === logic.destination);
              break;
            }
          }
        }

        if (!response.data[survey.questions[nextQuesIdx]?.id] && !response.finished) {
          dropoffArr[nextQuesIdx]++;
          viewsArr[nextQuesIdx]++;
          break;
        }

        currQuesIdx = nextQuesIdx;
      }
    });

    dropoffPercentageArr[0] = (dropoffArr[0] / displayCount) * 100 || 0;
    for (let i = 1; i < survey.questions.length; i++) {
      if (viewsArr[i - 1] !== 0) {
        dropoffPercentageArr[i] = (dropoffArr[i] / viewsArr[i - 1]) * 100;
      }
    }

    return [dropoffArr, viewsArr, dropoffPercentageArr];
  };

  const [dropoffCount, viewsCount, dropoffPercentage] = useMemo(() => getDropoff(), [responses]);

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 shadow-sm">
      <div className="rounded-b-lg bg-white ">
        <div className="grid h-10 grid-cols-5 items-center border-y border-slate-200 bg-slate-100 text-sm font-bold text-slate-600">
          <div className="col-span-3 pl-4 md:pl-6">Questions</div>
          <div className="pl-4 text-center md:pl-6">Views</div>
          <div className="px-4 text-center md:px-6">Drop-off</div>
        </div>
        {survey.questions.map((question, i) => (
          <div
            key={question.id}
            className="grid grid-cols-5 items-center border-b border-slate-100 py-2 text-sm text-slate-800 md:text-base">
            <div className="col-span-3 pl-4 md:pl-6">{question.headline}</div>
            <div className="whitespace-pre-wrap pl-6 text-center font-semibold">{viewsCount[i]}</div>
            <div className="px-4 text-center md:px-6">
              <span className="font-semibold">{dropoffCount[i]} </span>
              <span>({Math.round(dropoffPercentage[i])}%)</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
