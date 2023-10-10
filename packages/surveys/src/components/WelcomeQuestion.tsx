import { TResponseData } from "@formbricks/types/v1/responses";
import type { TSurveyWelcomeQuestion } from "@formbricks/types/v1/surveys";
import Headline from "./Headline";
import HtmlBody from "./HtmlBody";
import SubmitButton from "./SubmitButton";

interface WelcomeQuestionProps {
  question: TSurveyWelcomeQuestion;
  value: string | number | string[];
  onChange: (responseData: TResponseData) => void;
  onSubmit: (data: TResponseData) => void;
  isLastQuestion: boolean;
  brandColor: string;
}

export default function WelcomeQuestion({
  question,
  onSubmit,
  isLastQuestion,
  brandColor,
}: WelcomeQuestionProps) {
  console.log("Toasted Motherboard");
  return (
    <div>
      <img src={question.companyLogo}></img>
      <Headline headline={question.headline} questionId={question.id} />
      <HtmlBody htmlString={question.html} questionId={question.id} />

      <div className="mt-4 flex w-full justify-between">
        <div className="flex w-full justify-end">
          {!question.required && (
            <button
              tabIndex={0}
              type="button"
              onClick={() => {
                onSubmit({ [question.id]: "dismissed" });
              }}
              className="mr-4 flex items-center rounded-md px-3 py-3 text-base font-medium leading-4 hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 dark:text-slate-400">
              {question.dismissButtonLabel || "Skip"}
            </button>
          )}
          <SubmitButton
            question={question}
            isLastQuestion={isLastQuestion}
            brandColor={brandColor}
            focus={true}
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
