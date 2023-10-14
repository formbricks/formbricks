import { TResponseData } from "@formbricks/types/v1/responses";
import type { TSurveyWelcomeQuestion } from "@formbricks/types/v1/surveys";
import Headline from "./Headline";
import HtmlBody from "./HtmlBody";
import SubmitButton from "./SubmitButton";
import Image from "next/image";
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
  console.log(question);
  return (
    <div>
      {question.selectedFile && (
        <Image src={question.selectedFile} className="mb-4" width={75} height={75} alt="Company Logo" />
      )}

      <Headline headline={question.headline} questionId={question.id} />
      <HtmlBody htmlString={question.html} questionId={question.id} />

      <div className="mt-4 flex w-full justify-between">
        <div className="flex w-full justify-start gap-4">
          <SubmitButton
            question={question}
            isLastQuestion={isLastQuestion}
            brandColor={brandColor}
            focus={true}
            onClick={() => {
              onSubmit({ [question.id]: "clicked" });
            }}
            type="button"
          />
          <div className="flex items-center text-slate-600">Press Enter ↵</div>
        </div>
      </div>
    </div>
  );
}
