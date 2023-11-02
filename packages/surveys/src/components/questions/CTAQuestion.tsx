import { BackButton } from "../buttons/BackButton";
import SubmitButton from "../buttons/SubmitButton";
import Headline from "../general/Headline";
import HtmlBody from "../general/HtmlBody";
import { TResponseData } from "@formbricks/types/responses";
import type { TSurveyCTAQuestion } from "@formbricks/types/surveys";

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
      {question.imageUrl && (
        <div className="my-4 rounded-md">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={question.imageUrl} alt="question-image" className={"my-4 rounded-md"} />
        </div>
      )}
      <Headline headline={question.headline} questionId={question.id} required={question.required} />
      <HtmlBody htmlString={question.html} questionId={question.id} />

      <div className="mt-4 flex w-full justify-between">
        {!isFirstQuestion && (
          <BackButton backButtonLabel={question.backButtonLabel} onClick={() => onBack()} />
        )}
        <div className="flex w-full justify-end">
          {!question.required && (
            <button
              tabIndex={0}
              type="button"
              onClick={() => {
                onSubmit({ [question.id]: "dismissed" });
              }}
              className="mr-4 flex items-center rounded-md px-3 py-3 text-base font-medium leading-4 text-[--fb-heading-color] hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-[--fb-focus-color] focus:ring-offset-2">
              {question.dismissButtonLabel || "Skip"}
            </button>
          )}
          <SubmitButton
            buttonLabel={question.buttonLabel}
            isLastQuestion={isLastQuestion}
            focus={true}
            onClick={() => {
              if (question.buttonExternal && question.buttonUrl) {
                window?.open(question.buttonUrl, "_blank")?.focus();
              }
              onSubmit({ [question.id]: "clicked" });
            }}
            type="button"
            brandColor={brandColor}
          />
        </div>
      </div>
    </div>
  );
}
