import type { OpenTextQuestion } from "@formbricks/types/questions";
import { useEffect, useRef, useState } from "react";
import Headline from "./Headline";
import Subheader from "./Subheader";
import SubmitButton from "@/components/preview/SubmitButton";
import { Button } from "@formbricks/ui";
import { set } from "lodash";

interface OpenTextQuestionProps {
  question: OpenTextQuestion;
  onSubmit: (data: { [x: string]: any }) => void;
  lastQuestion: boolean;
  brandColor: string;
  savedAnswer: string | null;
  goToNextQuestion: () => void;
}

export default function OpenTextQuestion({
  question,
  onSubmit,
  lastQuestion,
  brandColor,
  savedAnswer,
  goToNextQuestion,
}: OpenTextQuestionProps) {
  const [value, setValue] = useState<string>("");

  useEffect(() => {
    setValue(savedAnswer ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = (value: string) => {
    const data = {
      [question.id]: value,
    };
    setValue(""); // reset value
    onSubmit(data);
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();

        if (savedAnswer === value) {
          goToNextQuestion();
          return;
        }

        handleSubmit(value);
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

        <SubmitButton {...{ question, lastQuestion, brandColor, savedAnswer, goToNextQuestion }} />
      </div>
    </form>
  );
}
