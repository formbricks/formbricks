import { type TSurveyQuestionId } from "@formbricks/types/surveys/types";

interface SubheaderProps {
  subheader?: string;
  questionId: TSurveyQuestionId;
}

export function Subheader({ subheader, questionId }: SubheaderProps) {
  return (
    <label
      htmlFor={questionId}
      className="fb-text-subheading fb-block fb-break-words fb-text-sm fb-font-normal fb-leading-6"
      dir="auto">
      {subheader}
    </label>
  );
}
