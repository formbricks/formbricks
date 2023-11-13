import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../../Tooltip";
import { ChevronDoubleDownIcon, XCircleIcon } from "@heroicons/react/20/solid";
import { TSurveyQuestion } from "@formbricks/types/surveys";

interface QuestionSkipProps {
  skippedQuestions: string[] | undefined;
  status: string;
  questions: TSurveyQuestion[];
}

export default function QuestionSkip({ skippedQuestions, status, questions }: QuestionSkipProps) {
  return (
    <>
      {skippedQuestions && (
        <div className="flex w-full p-2 text-sm text-slate-400">
          {status === "skipped" && (
            <div className="flex">
              <div
                className="flex w-0.5 items-center justify-center"
                style={{
                  background:
                    "repeating-linear-gradient(to bottom,   rgb(148 163 184),  rgb(148 163 184) 8px, transparent 5px, transparent 15px)", // adjust the values to fit your design
                }}>
                {skippedQuestions.length > 1 && (
                  <TooltipProvider delayDuration={50}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <ChevronDoubleDownIcon className="w-[1.25rem] min-w-[1.25rem] rounded-full bg-slate-400 p-0.5 text-white" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Respondent skipped these questions.</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>
              <div className="ml-6 flex flex-col">
                {skippedQuestions &&
                  skippedQuestions.map((questionId) => {
                    return (
                      <p className="my-2" key={questionId}>
                        {questions.find((question) => question.id === questionId)!.headline.en}
                      </p>
                    );
                  })}
              </div>
            </div>
          )}
          {status === "aborted" && (
            <div className="flex">
              <div
                className="flex w-0.5 flex-grow items-start justify-center"
                style={{
                  background:
                    "repeating-linear-gradient(to bottom,  rgb(148 163 184),  rgb(148 163 184) 2px, transparent 2px, transparent 10px)", // adjust the 2px to change dot size and 10px to change space between dots
                }}>
                <div className="flex">
                  <XCircleIcon className="min-h-[1.5rem] min-w-[1.5rem] rounded-full bg-white text-slate-400" />
                </div>
              </div>
              <div className="mb-2 ml-4 flex flex-col">
                <p className="mb-2 w-fit rounded-lg bg-slate-100 px-2 text-slate-700">Survey Closed</p>
                {skippedQuestions &&
                  skippedQuestions.map((questionId) => {
                    return (
                      <p className="my-2" key={questionId}>
                        {questions.find((question) => question.id === questionId)!.headline.en}
                      </p>
                    );
                  })}
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
