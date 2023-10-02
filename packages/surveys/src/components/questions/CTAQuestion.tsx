import { TResponseData } from "@formbricks/types/v1/responses";
import type { TSurveyCTAQuestion } from "@formbricks/types/v1/surveys";
import { BackButton } from "../buttons/BackButton";
import SubmitButton from "../buttons/SubmitButton";
import Headline from "../general/Headline";
import HtmlBody from "../general/HtmlBody";

interface CTAQuestionProps {
  question: TSurveyCTAQuestion;
  value: string | number | string[];
  onChange: (responseData: TResponseData) => void;
  onSubmit: (data: TResponseData) => void;
  onBack: () => void;
  isFirstQuestion: boolean;
  isLastQuestion: boolean;
  brandColor: string;
}

export default function CTAQuestion({
  question,
  onSubmit,
  onBack,
  isFirstQuestion,
  isLastQuestion,
  brandColor,
}: CTAQuestionProps) {
  return (
    <div>
      <Headline headline={question.headline} questionId={question.id} />
      <HtmlBody htmlString={question.html} questionId={question.id} />

      <div className="mt-4 flex w-full justify-between">
        {!isFirstQuestion && (
          <BackButton backButtonLabel={question.backButtonLabel} onClick={() => onBack()} />
        )}
        <div className="flex justify-end">
          {!question.required && (
            <button
              type="button"
              onClick={() => {
                onSubmit({ [question.id]: "dismissed" });
              }}
              className="mr-4 flex items-center rounded-md px-3 py-3 text-base font-medium leading-4 text-[--fb-text] hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-[--fb-ring-focus] focus:ring-offset-2">
              {question.dismissButtonLabel || "Skip"}
            </button>
          )}
          <SubmitButton
            question={question}
            isLastQuestion={isLastQuestion}
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
    </div>
  );
}
