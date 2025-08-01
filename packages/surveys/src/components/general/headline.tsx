import { type TSurveyQuestionId } from "@formbricks/types/surveys/types";

interface HeadlineProps {
  headline?: string;
  questionId: TSurveyQuestionId;
  required?: boolean;
  alignTextCenter?: boolean;
}
export function Headline({ headline, questionId, required = true, alignTextCenter = false }: HeadlineProps) {
  return (
    <label htmlFor={questionId} className="fb-text-heading fb-mb-1.5 fb-flex fb-flex-col">
      <span
        className="fb-text-xs fb-opacity-60 fb-font-normal"
        tabIndex={-1}
        style={{ visibility: required ? "hidden" : "visible" }}
        aria-hidden={required}
        data-testid="fb__surveys__headline-optional-text-test">
        Optional
      </span>
      <div
        className={`fb-flex fb-items-center ${alignTextCenter ? "fb-justify-center" : "fb-justify-between"}`}
        dir="auto">
        <p data-testid="fb__surveys__headline-text-test" className="fb-text-base fb-font-semibold">
          {headline}
        </p>
      </div>
    </label>
  );
}
