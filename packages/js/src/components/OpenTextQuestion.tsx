import { h } from "preact";
import type { OpenTextQuestion, Question } from "@formbricks/types/js";
import Headline from "./Headline";
import Subheader from "./Subheader";

interface OpenTextQuestionProps {
  question: OpenTextQuestion;
  onSubmit: (data: { [x: string]: any }) => void;
  lastQuestion: boolean;
  brandColor: string;
}

export default function OpenTextQuestion({
  question,
  onSubmit,
  lastQuestion,
  brandColor,
}: OpenTextQuestionProps) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const data = {
          [question.id]: e.currentTarget[question.id].value,
        };
        e.currentTarget[question.id].value = ""; // reset value
        onSubmit(data);
        // reset form
      }}>
      <Headline headline={question.headline} questionId={question.id} />
      <Subheader subheader={question.subheader} questionId={question.id} />
      <div className="fb-mt-4">
        <textarea
          rows={3}
          name={question.id}
          id={question.id}
          placeholder={question.placeholder}
          required={question.required}
          className="fb-block fb-w-full fb-rounded-md fb-border fb-p-2 fb-shadow-sm focus:fb-ring-0 sm:fb-text-sm fb-bg-slate-50 fb-border-slate-100 focus:fb-border-slate-500"></textarea>
      </div>
      <div className="fb-mt-4 fb-flex fb-w-full fb-justify-between">
        <div></div>
        <button
          type="submit"
          className="fb-flex fb-items-center fb-rounded-md fb-border fb-border-transparent fb-px-3 fb-py-3 fb-text-base fb-font-medium fb-leading-4 fb-text-white fb-shadow-sm hover:fb-opacity-90 focus:fb-outline-none focus:fb-ring-2 focus:fb-ring-offset-2 focus:fb-ring-slate-500"
          style={{ backgroundColor: brandColor }}>
          {question.buttonLabel || (lastQuestion ? "Finish" : "Next")}
        </button>
      </div>
    </form>
  );
}
