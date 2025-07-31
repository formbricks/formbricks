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
      className="fb-text-heading fb-relative fb-mb-1.5 fb-block fb-text-base fb-font-semibold fb-leading-6">
      <span
        className="fb-text-heading fb-text-xs fb-opacity-60 fb-absolute -fb-top-4"
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
