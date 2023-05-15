import type { CTAQuestion } from "../../../types/questions";
import { h } from "preact";
import Headline from "./Headline";
import HtmlBody from "./HtmlBody";
import SubmitButton from "./SubmitButton";

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
      <HtmlBody htmlString={question.html} questionId={question.id} />

      <div className="fb-mt-4 fb-flex fb-w-full fb-justify-end">
        <div></div>
        {!question.required && (
          <button
            type="button"
            onClick={() => {
              onSubmit({ [question.id]: "dismissed" });
            }}
            className="fb-flex fb-items-center dark:fb-text-slate-400 fb-rounded-md fb-px-3 fb-py-3 fb-text-base fb-font-medium fb-leading-4 fb-hover:opacity-90 fb-focus:outline-none fb-focus:ring-2 fb-focus:ring-slate-500 fb-focus:ring-offset-2 fb-mr-4">
            {question.dismissButtonLabel || "Skip"}
          </button>
        )}
        {/* <button
          type="button"
          onClick={() => {
            if (question.buttonExternal && question.buttonUrl) {
              window?.open(question.buttonUrl, "_blank")?.focus();
            }
            onSubmit({ [question.id]: "clicked" });
          }}
          className="fb-flex fb-items-center fb-rounded-md fb-border fb-border-transparent fb-px-3 fb-py-3 fb-text-base fb-font-medium fb-leading-4 fb-text-white fb-shadow-sm fb-hover:opacity-90 fb-focus:outline-none fb-focus:ring-2 fb-focus:ring-slate-500 fb-focus:ring-offset-2"
          style={{ backgroundColor: brandColor }}>
          {question.buttonLabel || (lastQuestion ? "Finish" : "Next")}
        </button> */}
        <SubmitButton
          question={question}
          lastQuestion={lastQuestion}
          brandColor={brandColor}
          onClick={() => {
            if (question.buttonExternal && question.buttonUrl) {
              window?.open(question.buttonUrl, "_blank")?.focus();
            }
            onSubmit({ [question.id]: "clicked" });
          }}
          type="button"
        />
      </div>
    </div>
  );
}
