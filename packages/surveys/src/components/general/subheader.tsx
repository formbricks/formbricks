import { type TSurveyQuestionId } from "@formbricks/types/surveys/types";

interface SubheaderProps {
  subheader?: string;
  questionId: TSurveyQuestionId;
}

export function Subheader({ subheader, questionId }: SubheaderProps) {
  return (
    <label
      htmlFor={questionId}
      className="text-subheading block break-words text-sm font-normal leading-6"
      dir="auto">
      {subheader}
    </label>
  );
}
