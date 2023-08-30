import React from "react";
import { ChevronDoubleDownIcon } from "@heroicons/react/20/solid";
import { XCircleIcon } from "@heroicons/react/20/solid";

export default function QuestionSkip({ skippedQuestions, status, questions }) {
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
                  <ChevronDoubleDownIcon className="w-[1.25rem] min-w-[1.25rem] rounded-full bg-slate-500 text-white" />
                )}
              </div>
              <div className="ml-6 flex flex-col">
                {skippedQuestions &&
                  skippedQuestions.map((questionId) => {
                    return (
                      <p className="my-2">
                        {questions.find((question) => question.id === questionId).headline}
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
                  <XCircleIcon className="min-h-[1.5rem] min-w-[1.5rem] rounded-full bg-white text-slate-500" />
                </div>
              </div>
              <div className="mb-2 ml-4 flex flex-col">
                <p className="mb-2 w-fit rounded-lg bg-slate-100 px-2 text-slate-700">Survey Closed</p>
                {skippedQuestions &&
                  skippedQuestions.map((questionId) => {
                    return (
                      <p className="my-2">
                        {questions.find((question) => question.id === questionId).headline}
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
