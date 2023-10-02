import { TSurveyQuestion } from "@formbricks/types/v1/surveys";
import { cn } from "../../../../lib/cn";

interface SubmitButtonProps {
  question: TSurveyQuestion;
  isLastQuestion: boolean;
  onClick: () => void;
  type?: "submit" | "button";
  // DEPRECATED
  brandColor?: string;
}

function SubmitButton({ question, isLastQuestion, onClick, type = "submit" }: SubmitButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "flex items-center rounded-md border border-[--fb-submit-btn-border] bg-[--fb-primary] px-3 py-3 text-base font-medium leading-4 text-[--fb-on-primary] shadow-sm hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-[--fb-ring-focus] focus:ring-offset-2"
      )}
      onClick={onClick}>
      {question.buttonLabel || (isLastQuestion ? "Finish" : "Next")}
    </button>
  );
}
export default SubmitButton;
