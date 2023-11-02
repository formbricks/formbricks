import { BackButton } from "../buttons/BackButton";
import SubmitButton from "../buttons/SubmitButton";
import Headline from "../general/Headline";
import HtmlBody from "../general/HtmlBody";
import { TResponseData } from "@formbricks/types/responses";
import type { TSurveyConsentQuestion } from "@formbricks/types/surveys";

interface ConsentQuestionProps {
  question: TSurveyConsentQuestion;
  value: string | number | string[];
  onChange: (responseData: TResponseData) => void;
  onSubmit: (data: TResponseData) => void;
  onBack: () => void;
  isFirstQuestion: boolean;
  isLastQuestion: boolean;
  brandColor: string;
}

export default function ConsentQuestion({
  question,
  value,
  onChange,
  onSubmit,
  onBack,
  isFirstQuestion,
  isLastQuestion,
  brandColor,
}: ConsentQuestionProps) {
  return (
    <div>
      {question.imageUrl && (
        <div className="my-4 rounded-md">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={question.imageUrl} alt="question-image" className={"my-4 rounded-md"} />
        </div>
      )}
      <Headline headline={question.headline} questionId={question.id} required={question.required} />
      <HtmlBody htmlString={question.html || ""} questionId={question.id} />

      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit({ [question.id]: value });
        }}>
        <label
          tabIndex={1}
          onKeyDown={(e) => {
            if (e.key == "Enter") {
              onChange({ [question.id]: "accepted" });
            }
          }}
          className="relative z-10 mt-4 flex w-full cursor-pointer items-center rounded-md border border-[--fb-border-color] bg-[--fb-survey-background-color] p-4 text-sm text-[--fb-heading-color] hover:bg-[--fb-accent-background-color] focus:bg-[--fb-accent-background-color] focus:outline-none focus:ring-2 focus:ring-[--fb-border-color-highlight] focus:ring-offset-2">
          <input
            type="checkbox"
            id={question.id}
            name={question.id}
            value={question.label}
            onChange={(e) => {
              if (e.target instanceof HTMLInputElement && e.target.checked) {
                onChange({ [question.id]: "accepted" });
              } else {
                onChange({ [question.id]: "dismissed" });
              }
            }}
            checked={value === "accepted"}
            className="h-4 w-4 border border-[--fb-brand-color] text-[--fb-brand-color] focus:ring-0 focus:ring-offset-0"
            aria-labelledby={`${question.id}-label`}
            required={question.required}
          />
          <span id={`${question.id}-label`} className="ml-3 font-medium">
            {question.label}
          </span>
        </label>

        <div className="mt-4 flex w-full justify-between">
          {!isFirstQuestion && (
            <BackButton tabIndex={3} backButtonLabel={question.backButtonLabel} onClick={() => onBack()} />
          )}
          <div />
          <SubmitButton
            tabIndex={2}
            buttonLabel={question.buttonLabel}
            isLastQuestion={isLastQuestion}
            onClick={() => {}}
            brandColor={brandColor}
          />
        </div>
      </form>
    </div>
  );
}
