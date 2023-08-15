import { TResponseData } from "@formbricks/types/v1/responses";
import type { TSurveyConsentQuestion } from "@formbricks/types/v1/surveys";
import { useState } from "preact/hooks";
import { BackButton } from "./BackButton";
import Headline from "./Headline";
import HtmlBody from "./HtmlBody";
import SubmitButton from "./SubmitButton";

interface ConsentQuestionProps {
  question: TSurveyConsentQuestion;
  onSubmit: (data: TResponseData) => void;
  onBack: (responseData: TResponseData) => void;
  isFirstQuestion: boolean;
  isLastQuestion: boolean;
  brandColor: string;
}

export default function ConsentQuestion({
  question,
  onSubmit,
  onBack,
  isFirstQuestion,
  isLastQuestion,
  brandColor,
}: ConsentQuestionProps) {
  const [answer, setAnswer] = useState<string>("dismissed");

  const handleOnChange = () => {
    answer === "accepted" ? setAnswer("dissmissed") : setAnswer("accepted");
  };

  const handleSumbit = (value: string) => {
    const data = {
      [question.id]: value,
    };
    onSubmit(data);
    setAnswer("dismissed");
  };
  return (
    <div>
      <Headline headline={question.headline} questionId={question.id} />
      <HtmlBody htmlString={question.html || ""} questionId={question.id} />

      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSumbit(answer);
        }}>
        <label className="relative z-10 mt-4 flex w-full cursor-pointer items-center rounded-md border border-gray-200 bg-slate-50 p-4 text-sm text-slate-800 focus:outline-none">
          <input
            type="checkbox"
            id={question.id}
            name={question.id}
            value={question.label}
            onChange={handleOnChange}
            checked={answer === "accepted"}
            className="h-4 w-4 border border-slate-300 focus:ring-0 focus:ring-offset-0"
            aria-labelledby={`${question.id}-label`}
            style={{ borderColor: brandColor, color: brandColor }}
            required={question.required}
          />
          <span id={`${question.id}-label`} className="ml-3 font-medium">
            {question.label}
          </span>
        </label>

        <div className="mt-4 flex w-full justify-between">
          {!isFirstQuestion && (
            <BackButton
              onClick={() =>
                onBack({
                  [question.id]: answer,
                })
              }
            />
          )}
          <div />
          <SubmitButton
            brandColor={brandColor}
            question={question}
            isLastQuestion={isLastQuestion}
            onClick={() => {}}
          />
        </div>
      </form>
    </div>
  );
}
