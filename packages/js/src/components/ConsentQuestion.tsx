import type { ConsentQuestion } from "../../../types/questions";
import { h } from "preact";
import Headline from "./Headline";
import HtmlBody from "./HtmlBody";
import SubmitButton from "./SubmitButton";

interface ConsentQuestionProps {
  question: ConsentQuestion;
  onSubmit: (data: { [x: string]: any }) => void;
  lastQuestion: boolean;
  brandColor: string;
}

export default function ConsentQuestion({
  question,
  onSubmit,
  lastQuestion,
  brandColor,
}: ConsentQuestionProps) {
  return (
    <div>
      <Headline headline={question.headline} questionId={question.id} />
      <HtmlBody htmlString={question.html || ""} questionId={question.id} />

      <form
        onSubmit={(e) => {
          e.preventDefault();

          const checkbox = document.getElementById(question.id) as HTMLInputElement;
          onSubmit({ [question.id]: checkbox.checked ? "accepted" : "skipped" });
        }}>
        <label className="fb-relative fb-z-10 fb-mt-4 fb-flex fb-w-full fb-cursor-pointer fb-items-center fb-rounded-md fb-border fb-border-gray-200 fb-bg-slate-50 fb-p-4 fb-text-sm focus:fb-outline-none">
          <input
            type="checkbox"
            id={question.id}
            name={question.id}
            value={question.label}
            className="fb-h-4 fb-w-4 fb-border fb-border-slate-300 focus:fb-ring-0 focus:fb-ring-offset-0"
            aria-labelledby={`${question.id}-label`}
            style={{ borderColor: brandColor, color: brandColor }}
            required={question.required}
          />
          <span id={`${question.id}-label`} className="fb-ml-3 fb-font-medium">
            {question.label}
          </span>
        </label>

        <div className="fb-mt-4 fb-flex fb-w-full fb-justify-end">
          {!question.required && (
            <button
              type="button"
              onClick={() => {
                onSubmit({ [question.id]: "skipped" });
              }}
              className="fb-mr-4 fb-flex fb-items-center fb-rounded-md fb-px-3 fb-py-3 fb-text-base fb-font-medium fb-leading-4 fb-text-slate-500 hover:fb-opacity-90 focus:fb-outline-none focus:fb-ring-2 focus:fb-ring-slate-500 focus:fb-ring-offset-2 dark:fb-border-slate-400 dark:fb-text-slate-400">
              {question.dismissButtonLabel || "Skip"}
            </button>
          )}
          <SubmitButton
            brandColor={brandColor}
            question={question}
            lastQuestion={lastQuestion}
            onClick={() => {}}
          />
        </div>
      </form>
    </div>
  );
}
