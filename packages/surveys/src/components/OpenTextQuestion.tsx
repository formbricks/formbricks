import { TResponseData } from "@formbricks/types/v1/responses";
import type { TSurveyOpenTextQuestion } from "@formbricks/types/v1/surveys";
import { useState } from "preact/hooks";
import { BackButton } from "./BackButton";
import Headline from "./Headline";
import Subheader from "./Subheader";
import SubmitButton from "./SubmitButton";

interface OpenTextQuestionProps {
  question: TSurveyOpenTextQuestion;
  onSubmit: (data: TResponseData) => void;
  onBack: (responseData: TResponseData) => void;
  isFirstQuestion: boolean;
  isLastQuestion: boolean;
  brandColor: string;
}

export default function OpenTextQuestion({
  question,
  onSubmit,
  onBack,
  isFirstQuestion,
  isLastQuestion,
  brandColor,
}: OpenTextQuestionProps) {
  const [value, setValue] = useState<string>("");

  const handleSubmit = (value: string) => {
    const data = {
      [question.id]: value,
    };
    onSubmit(data);
    setValue(""); // reset value
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        handleSubmit(value);
      }}>
      <Headline headline={question.headline} questionId={question.id} />
      <Subheader subheader={question.subheader} questionId={question.id} />
      <div className="mt-4">
        {question.longAnswer === false ? (
          <input
            name={question.id}
            id={question.id}
            placeholder={question.placeholder}
            required={question.required}
            value={value}
            onInput={(e) => setValue(e.currentTarget.value)}
            className="block w-full rounded-md border border-slate-100 bg-slate-50 p-2 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-0 sm:text-sm"
          />
        ) : (
          <textarea
            rows={3}
            name={question.id}
            id={question.id}
            placeholder={question.placeholder}
            required={question.required}
            value={value}
            onInput={(e) => setValue(e.currentTarget.value)}
            className="block w-full rounded-md border border-slate-100 bg-slate-50 p-2 shadow-sm focus:border-slate-500 focus:ring-0 sm:text-sm"></textarea>
        )}
      </div>
      <div className="mt-4 flex w-full justify-between">
        {!isFirstQuestion && (
          <BackButton
            onClick={() => {
              onBack({
                [question.id]: value,
              });
            }}
          />
        )}
        <div></div>
        <SubmitButton
          question={question}
          isLastQuestion={isLastQuestion}
          brandColor={brandColor}
          onClick={() => {}}
        />
      </div>
    </form>
  );
}
