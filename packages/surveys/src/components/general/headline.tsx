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
      className="fb-text-heading fb-mb-1.5 fb-block fb-text-base fb-font-semibold fb-leading-6">
      <div
        className={`fb-flex fb-items-center ${alignTextCenter ? "fb-justify-center" : "fb-justify-between"}`}
        dir="auto">
        {headline}
        {!required && (
          <span
            className="fb-text-heading fb-mx-2 fb-self-start fb-text-sm fb-font-normal fb-leading-7 fb-opacity-60"
            tabIndex={-1}>
            Optional
          </span>
        )}
      </div>
    </label>
  );
}
