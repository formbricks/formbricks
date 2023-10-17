import { TResponseData } from "@formbricks/types/v1/responses";
import type { TSurveyNPSQuestion } from "@formbricks/types/v1/surveys";
import { cn } from "../../lib/utils";
import { BackButton } from "../buttons/BackButton";
import SubmitButton from "../buttons/SubmitButton";
import Headline from "../general/Headline";
import Subheader from "../general/Subheader";

interface NPSQuestionProps {
  question: TSurveyNPSQuestion;
  value: string | number | string[];
  onChange: (responseData: TResponseData) => void;
  onSubmit: (data: TResponseData) => void;
  onBack: () => void;
  isFirstQuestion: boolean;
  isLastQuestion: boolean;
  brandColor: string;
}

export default function NPSQuestion({
  question,
  value,
  onChange,
  onSubmit,
  onBack,
  isFirstQuestion,
  isLastQuestion,
  brandColor,
}: NPSQuestionProps) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ [question.id]: value });
      }}>
      <Headline headline={question.headline} questionId={question.id} required={question.required} />
      <Subheader subheader={question.subheader} questionId={question.id} />
      <div className="my-4">
        <fieldset>
          <legend className="sr-only">Options</legend>
          <div className="flex">
            {Array.from({ length: 11 }, (_, i) => i).map((number, idx) => (
              <label
                key={number}
                tabIndex={idx + 1}
                onKeyDown={(e) => {
                  if (e.key == "Enter") {
                    onSubmit({ [question.id]: number });
                  }
                }}
                className={cn(
                  value === number
                    ? "z-10 border-[--fb-border-highlight] bg-[--fb-bg-selected]"
                    : "border-[--fb-border]",
                  "relative h-10 flex-1 cursor-pointer border bg-[--fb-bg] text-center text-sm leading-10 text-[--fb-text] first:rounded-l-md last:rounded-r-md hover:bg-[--fb-bg-2] focus:outline-none"
                )}>
                <input
                  type="radio"
                  name="nps"
                  value={number}
                  checked={value === number}
                  className="absolute h-full w-full cursor-pointer opacity-0"
                  onClick={() => {
                    if (question.required) {
                      onSubmit({
                        [question.id]: number,
                      });
                    }
                    onChange({ [question.id]: number });
                  }}
                  required={question.required}
                />
                {number}
              </label>
            ))}
          </div>
          <div className="flex justify-between px-1.5 text-xs leading-6 text-[--fb-text-3]">
            <p>{question.lowerLabel}</p>
            <p>{question.upperLabel}</p>
          </div>
        </fieldset>
      </div>

      <div className="mt-4 flex w-full justify-between">
        {!isFirstQuestion && (
          <BackButton
            tabIndex={isLastQuestion ? 12 : 13}
            backButtonLabel={question.backButtonLabel}
            onClick={() => {
              onBack();
            }}
          />
        )}
        <div></div>
        {!question.required && (
          <SubmitButton
            tabIndex={12}
            buttonLabel={question.buttonLabel}
            isLastQuestion={isLastQuestion}
            brandColor={brandColor}
            onClick={() => {}}
          />
        )}
      </div>
    </form>
  );
}
