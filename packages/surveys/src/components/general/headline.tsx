import { type TSurveyQuestionId } from "@formbricks/types/surveys/types";

interface HeadlineProps {
  headline?: string;
  questionId: TSurveyQuestionId;
  required?: boolean;
  alignTextCenter?: boolean;
}
export function Headline({ headline, questionId, required = true, alignTextCenter = false }: HeadlineProps) {
  return (
    <label
      htmlFor={questionId}
      className="fb-text-heading fb-mb-1.5 fb-text-base fb-font-semibold fb-flex fb-flex-col">
      <span
        className="fb-text-heading fb-text-xs fb-opacity-60"
        tabIndex={-1}
        style={{ visibility: required ? "hidden" : "visible" }}
        aria-hidden="true">
        Optional
      </span>
      <div
        className={`fb-flex fb-items-center ${alignTextCenter ? "fb-justify-center" : "fb-justify-between"}`}
        dir="auto">
        <p>{headline}</p>
      </div>
    </label>
  );
}
