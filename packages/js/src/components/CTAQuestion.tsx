import { h } from "preact";
import type { CTAQuestion } from "@formbricks/types/questions";
import Headline from "./Headline";
import Subheader from "./Subheader";

interface CTAQuestionProps {
  question: CTAQuestion;
  onSubmit: (data: { [x: string]: any }) => void;
  lastQuestion: boolean;
  brandColor: string;
}

export default function CTAQuestion({ question, onSubmit, lastQuestion, brandColor }: CTAQuestionProps) {
  return (
    <div>
      <Headline headline={question.headline} questionId={question.id} />
      <Subheader subheader={question.subheader} questionId={question.id} />

      <div className="fb-mt-4 fb-flex fb-w-full fb-justify-between">
        <div></div>
        {!question.required && (
          <button
            type="button"
            onClick={() => {
              onSubmit({ [question.id]: "clicked" });
            }}
            className="fb-flex fb-items-center fb-border-slate-500 fb-text-slate-500 dark:fb-border-slate-400 dark:fb-text-slate-400 fb-rounded-md fb-border fb-px-3 fb-py-3 fb-text-base fb-font-medium fb-leading-4 fb-shadow-sm fb-hover:opacity-90 fb-focus:outline-none fb-focus:ring-2 fb-focus:ring-slate-500 fb-focus:ring-offset-2">
            {question.dismissButtonLabel || "Dismiss"}
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            if (question.buttonExternal && question.buttonUrl) {
              window?.open(question.buttonUrl, "_blank")?.focus();
            }
            onSubmit({ [question.id]: "dismissed" });
          }}
          className="fb-flex fb-items-center fb-rounded-md fb-border fb-border-transparent fb-px-3 fb-py-3 fb-text-base fb-font-medium fb-leading-4 fb-text-white fb-shadow-sm fb-hover:opacity-90 fb-focus:outline-none fb-focus:ring-2 fb-focus:ring-slate-500 fb-focus:ring-offset-2"
          style={{ backgroundColor: brandColor }}>
          {question.buttonLabel || (lastQuestion ? "Finish" : "Next")}
        </button>
      </div>
    </div>
  );
}
