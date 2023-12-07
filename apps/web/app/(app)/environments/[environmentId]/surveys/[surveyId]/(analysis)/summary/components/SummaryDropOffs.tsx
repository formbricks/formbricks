import { evaluateCondition } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/components/evaluateLogic";
import { TResponse } from "@formbricks/types/responses";
import { TSurvey } from "@formbricks/types/surveys";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@formbricks/ui/Tooltip";
import { TimerIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

interface SummaryDropOffsProps {
  survey: TSurvey;
  responses: TResponse[];
  displayCount: number;
}

export default function SummaryDropOffs({ responses, survey, displayCount }: SummaryDropOffsProps) {
  const initialAvgTtc = useMemo(
    () =>
      survey.questions.reduce((acc, question) => {
        acc[question.id] = 0;
        return acc;
      }, {}),
    [survey.questions]
  );

  const [avgTtc, setAvgTtc] = useState(initialAvgTtc);

  interface DropoffMetricsType {
    dropoffCount: number[];
    viewsCount: number[];
    dropoffPercentage: number[];
  }
  const [dropoffMetrics, setDropoffMetrics] = useState<DropoffMetricsType>({
    dropoffCount: [],
    viewsCount: [],
    dropoffPercentage: [],
  });

  const calculateMetrics = useCallback(() => {
    let totalTtc = { ...initialAvgTtc };
    let responseCounts = { ...initialAvgTtc };

    let dropoffArr = new Array(survey.questions.length).fill(0);
    let viewsArr = new Array(survey.questions.length).fill(0);
    let dropoffPercentageArr = new Array(survey.questions.length).fill(0);

    responses.forEach((response) => {
      // Calculate total time-to-completion
      Object.keys(avgTtc).forEach((questionId) => {
        if (response.ttc && response.ttc[questionId]) {
          totalTtc[questionId] += response.ttc[questionId];
          responseCounts[questionId]++;
        }
      });

      let currQuesIdx = 0;

      while (currQuesIdx < survey.questions.length) {
        const currQues = survey.questions[currQuesIdx];
        if (!currQues) break;

        if (!currQues.required) {
          if (!response.data[currQues.id]) {
            viewsArr[currQuesIdx]++;

            if (currQuesIdx === survey.questions.length - 1 && !response.finished) {
              dropoffArr[currQuesIdx]++;
              break;
            }

            const questionHasCustomLogic = currQues.logic;
            if (questionHasCustomLogic) {
              let didLogicPass = false;
              for (let logic of questionHasCustomLogic) {
                if (!logic.destination) continue;
                if (evaluateCondition(logic, response.data[currQues.id] ?? null)) {
                  didLogicPass = true;
                  currQuesIdx = survey.questions.findIndex((q) => q.id === logic.destination);
                  break;
                }
              }
              if (!didLogicPass) currQuesIdx++;
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

    // Calculate the average time for each question
    Object.keys(totalTtc).forEach((questionId) => {
      totalTtc[questionId] =
        responseCounts[questionId] > 0 ? totalTtc[questionId] / responseCounts[questionId] : 0;
    });

    // Calculate drop-off percentages
    dropoffPercentageArr[0] = (dropoffArr[0] / displayCount) * 100 || 0;
    for (let i = 1; i < survey.questions.length; i++) {
      if (viewsArr[i - 1] !== 0) {
        dropoffPercentageArr[i] = (dropoffArr[i] / viewsArr[i - 1]) * 100;
      }
    }

    return {
      newAvgTtc: totalTtc,
      dropoffCount: dropoffArr,
      viewsCount: viewsArr,
      dropoffPercentage: dropoffPercentageArr,
    };
  }, [responses, survey.questions, displayCount, initialAvgTtc, avgTtc]);

  useEffect(() => {
    const { newAvgTtc, dropoffCount, viewsCount, dropoffPercentage } = calculateMetrics();
    setAvgTtc(newAvgTtc);
    setDropoffMetrics({ dropoffCount, viewsCount, dropoffPercentage });
  }, [responses]);

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 shadow-sm">
      <div className="rounded-b-lg bg-white ">
        <div className="grid h-10 grid-cols-6 items-center border-y border-slate-200 bg-slate-100 text-sm font-semibold text-slate-600">
          <div className="col-span-3 pl-4 md:pl-6">Questions</div>
          <div className="flex justify-center">
            <TooltipProvider delayDuration={50}>
              <Tooltip>
                <TooltipTrigger>
                  <TimerIcon className="h-5 w-5" />
                </TooltipTrigger>
                <TooltipContent side={"top"}>
                  <p className="text-center font-normal">Average time to complete each question.</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <div className="px-4 text-center md:px-6">Views</div>
          <div className="pr-6 text-center md:pl-6">Drop Offs</div>
        </div>
        {survey.questions.map((question, i) => (
          <div
            key={question.id}
            className="grid grid-cols-6 items-center border-b border-slate-100 py-2 text-sm text-slate-800 md:text-base">
            <div className="col-span-3 pl-4 md:pl-6">{question.headline}</div>
            <div className="whitespace-pre-wrap text-center font-semibold">
              {avgTtc[question.id] !== undefined ? (avgTtc[question.id] / 1000).toFixed(2) + "s" : "N/A"}
            </div>
            <div className="whitespace-pre-wrap text-center font-semibold">
              {dropoffMetrics.viewsCount[i]}
            </div>
            <div className=" pl-6 text-center md:px-6">
              <span className="font-semibold">{dropoffMetrics.dropoffCount[i]} </span>
              <span>({Math.round(dropoffMetrics.dropoffPercentage[i])}%)</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
