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

      <div className="mt-4 flex w-full justify-between">
        <div></div>
        {!question.required && (
          <button
            type="button"
            onClick={() => {
              onSubmit({ [question.id]: false });
            }}
            className="flex items-center rounded-md border border-slate-500 px-3 py-3 text-base font-medium leading-4 text-slate-500 shadow-sm hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 dark:border-slate-400 dark:text-slate-400">
            {question.dismissButtonLabel || "Dismiss"}
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            if (question.buttonExternal && question.buttonUrl) {
              window?.open(question.buttonUrl, "_blank")?.focus();
            }
            onSubmit({ [question.id]: true });
          }}
          className="flex items-center rounded-md border border-transparent px-3 py-3 text-base font-medium leading-4 text-white shadow-sm hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2"
          style={{ backgroundColor: brandColor }}>
          {question.buttonLabel || (lastQuestion ? "Finish" : "Next")}
        </button>
      </div>
    </div>
  );
}
