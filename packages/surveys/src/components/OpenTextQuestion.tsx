import { TResponseData } from "@formbricks/types/v1/responses";
import type { TSurveyOpenTextQuestion } from "@formbricks/types/v1/surveys";
import { BackButton } from "./BackButton";
import Headline from "./Headline";
import Subheader from "./Subheader";
import SubmitButton from "./SubmitButton";

interface OpenTextQuestionProps {
  question: TSurveyOpenTextQuestion;
  value: string | number | string[];
  onChange: (responseData: TResponseData) => void;
  onSubmit: (data: TResponseData) => void;
  onBack: () => void;
  isFirstQuestion: boolean;
  isLastQuestion: boolean;
  brandColor: string;
  autoFocus?: boolean;
}

export default function OpenTextQuestion({
  question,
  value,
  onChange,
  onSubmit,
  onBack,
  isFirstQuestion,
  isLastQuestion,
  brandColor,
  autoFocus = true,
}: OpenTextQuestionProps) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ [question.id]: value });
      }}
      className="w-full">
      <Headline headline={question.headline} questionId={question.id} required={question.required} />
      <Subheader subheader={question.subheader} questionId={question.id} />
      <div className="mt-4">
        {question.longAnswer === false ? (
          <input
            name={question.id}
            id={question.id}
            placeholder={question.placeholder}
            required={question.required}
            value={value}
            onInput={(e) => {
              onChange({ [question.id]: e.currentTarget.value });
            }}
            autoFocus={autoFocus}
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
            onInput={(e) => {
              onChange({ [question.id]: e.currentTarget.value });
            }}
            autoFocus={autoFocus}
            className="block w-full rounded-md border border-slate-100 bg-slate-50 p-2 shadow-sm focus:border-slate-500 focus:ring-0 sm:text-sm"></textarea>
        )}
      </div>
      <div className="mt-4 flex w-full justify-between">
        {!isFirstQuestion && (
          <BackButton
            backButtonLabel={question.backButtonLabel}
            onClick={() => {
              onBack();
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
