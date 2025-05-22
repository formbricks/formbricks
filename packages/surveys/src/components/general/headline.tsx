import { type TSurveyQuestionId } from "@formbricks/types/surveys/types";

interface HeadlineProps {
  headline?: string;
  // NOTE: Consider making into styles prop similar to StackedCard in the future if more styles are needed
  headlineColor?: string;
  questionId: TSurveyQuestionId;
  required?: boolean;
  alignTextCenter?: boolean;
}
export function Headline({
  headline,
  headlineColor,
  questionId,
  required = true,
  alignTextCenter = false,
}: HeadlineProps) {
  return (
    <label htmlFor={questionId} className="text-heading mb-1.5 block text-base font-semibold leading-6">
      <div
        className={`flex items-center ${alignTextCenter ? "justify-center" : "justify-between"}`}
        dir="auto">
        <span style={headlineColor ? { color: headlineColor } : undefined}>{headline}</span>
        {!required && (
          <span
            className="text-heading mx-2 self-start text-sm font-normal leading-7 opacity-60"
            tabIndex={-1}>
            Optional
          </span>
        )}
      </div>
    </label>
  );
}
