import { cn } from "../../../lib/cn";
import { isLight } from "../lib/utils";
import { TSurveyQuestion } from "../../../types/v1/surveys";

interface SubmitButtonProps {
  question: TSurveyQuestion;
  lastQuestion: boolean;
  brandColor: string;
  onClick: () => void;
  type?: "submit" | "button";
}

function SubmitButton({ question, lastQuestion, brandColor, onClick, type = "submit" }: SubmitButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "fb-flex fb-items-center fb-rounded-md fb-border fb-border-transparent fb-px-3 fb-py-3 fb-text-base fb-font-medium fb-leading-4 fb-shadow-sm hover:fb-opacity-90 focus:fb-outline-none focus:fb-ring-2 focus:fb-ring-slate-500 focus:fb-ring-offset-2",
        isLight(brandColor) ? "fb-text-black" : "fb-text-white"
      )}
      style={{ backgroundColor: brandColor }}
      onClick={onClick}>
      {question.buttonLabel || (lastQuestion ? "Finish" : "Next")}
    </button>
  );
}
export default SubmitButton;
