import type { OpenTextQuestion } from "../../../types/questions";
import { h } from "preact";
import Headline from "./Headline";
import Subheader from "./Subheader";
import SubmitButton from "./SubmitButton";

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
        {question.longAnswer === false ? (
          <input
            name={question.id}
            id={question.id}
            placeholder={question.placeholder}
            required={question.required}
            className="fb-block fb-w-full fb-rounded-md fb-border fb-p-2 fb-shadow-sm focus:fb-ring-0 sm:fb-text-sm fb-bg-slate-50 fb-border-slate-100 focus:fb-border-slate-500 focus:fb-outline-none"
          />
        ) : (
          <textarea
            rows={3}
            name={question.id}
            id={question.id}
            placeholder={question.placeholder}
            required={question.required}
            className="fb-block fb-w-full fb-rounded-md fb-border fb-p-2 fb-shadow-sm focus:fb-ring-0 sm:fb-text-sm fb-bg-slate-50 fb-border-slate-100 focus:fb-border-slate-500"></textarea>
        )}
      </div>
      <div className="fb-mt-4 fb-flex fb-w-full fb-justify-between">
        <div></div>
        <SubmitButton
          question={question}
          lastQuestion={lastQuestion}
          brandColor={brandColor}
          onClick={() => {}}
        />
      </div>
    </form>
  );
}
