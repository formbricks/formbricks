import { QuestionSummary } from "@formbricks/types/responses";
import { TResponse } from "@formbricks/types/v1/responses";
import { TSurveyQuestion, TSurveyWithAnalytics } from "@formbricks/types/v1/surveys";
import { useMemo } from "react";
import {} from "@formbricks/surveys";
interface SummaryDropOffsProps {
  summaryData: QuestionSummary<TSurveyQuestion>[];
  survey: TSurveyWithAnalytics;
  responses: TResponse[];
}

export default function SummaryDropOffs({ summaryData, responses, survey }: SummaryDropOffsProps) {
  console.log("SummaryDropOffs", {
    summaryData,
    responses,
    survey,
  });

  const getDropoff = () => {
    let dropoffArr = new Array(survey.questions.length).fill(0);

    // calculating dropoff for each response
    responses.forEach((response) => {
      // if a survey is finished, then we don't need to calculate dropoff
      if (response.finished) return;

      // possible dropoff index, variable to keep track of the last question that was answered
      let possibleDropoffIdx = 0;

      // loop through each question in the survey
      for (let i = 0; i < survey.questions.length; i++) {
        const currQues = survey.questions[i];
        const currResp = response.data[currQues.id];

        if (currQues.required && !currResp) {
          // if a question is required and not answered, then we can calculate dropoff
          dropoffArr[possibleDropoffIdx]++;
          break;
        } else if (i === survey.questions.length - 1) {
          // if we are at the last question, then we can calculate dropoff
          dropoffArr[possibleDropoffIdx]++;
          break;
        } else if (!currQues.required && !currResp) {
          // if a question is not required and not answered, then we can't calculate dropoff and we move on to the next question
          continue;
        } else if (currResp) {
          //if there is a response

          // setting the possible dropoff index to the current question index
          possibleDropoffIdx = i;

          if (!currQues.logic) {
            // if there is no logic, then we can move on to the next question
            continue;
          } else {
            // if there is logic, then we need to check the logical destination
            let respondedLogic: any = null;

            // loop through each logic in the question, and checking for which logic was responded to by the user(it is being used as a workaround for evaluateCondition function)
            for (let logic of currQues.logic) {
              if (!logic.destination) continue;
              if (response.data[logic.destination]) {
                // if the get the logic that was responded to by the user, then we set the respondedLogic variable to that logic and break out of the loop
                respondedLogic = logic;
                possibleDropoffIdx = survey.questions.findIndex((q) => q.id === logic.destination);
                break;
              }
            }
            if (!respondedLogic) {
              // if there is no responded logic, then we can move on to the next question
              dropoffArr[possibleDropoffIdx]++;
              break;
            } else {
              // if there is a responded logic, then we change the current question index to the index of the logical destination(-1 here because we are incrementing the index in the for loop)
              i = possibleDropoffIdx - 1;
            }
          }
        }
      }
    });
    return dropoffArr;
  };

  // getting correct dropoff values for each question
  console.log("dropoff", getDropoff());

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
