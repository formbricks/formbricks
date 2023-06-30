import type { OpenTextQuestion } from "@formbricks/types/questions";
import { useState } from "react";
import Headline from "./Headline";
import Subheader from "./Subheader";
import SubmitButton from "@/components/preview/SubmitButton";

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
  const [value, setValue] = useState<string>("");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();

        const data = {
          [question.id]: value,
        };
        setValue(""); // reset value
        onSubmit(data);
      }}>
      <Headline headline={question.headline} questionId={question.id} />
      <Subheader subheader={question.subheader} questionId={question.id} />
      <div className="mt-4">
        {question.longAnswer === false ? (
          <input
            autoFocus
            name={question.id}
            id={question.id}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={question.placeholder}
            required={question.required}
            className="block w-full rounded-md border border-slate-100 bg-slate-50 p-2 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-0 sm:text-sm"
          />
        ) : (
          <textarea
            autoFocus
            rows={3}
            name={question.id}
            id={question.id}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={question.placeholder}
            required={question.required}
            className="block w-full rounded-md border border-slate-100 bg-slate-50 p-2 shadow-sm focus:border-slate-500 focus:ring-0 sm:text-sm"
          />
        )}
      </div>
      <div className="mt-4 flex w-full justify-between">
        <div></div>
        <SubmitButton {...{ question, lastQuestion, brandColor }} />
      </div>
    </form>
  );
}
