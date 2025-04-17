import { Tooltip } from "@/components/general/tooltip";
import { CircleHelp } from "lucide-react";
import { type TSurveyQuestionId } from "@formbricks/types/surveys/types";

interface HeadlineProps {
  headline?: string;
  questionId: TSurveyQuestionId;
  required?: boolean;
  alignTextCenter?: boolean;
  tooltipContent?: string;
}

export function Headline({
  headline,
  questionId,
  required = true,
  alignTextCenter = false,
  tooltipContent,
}: HeadlineProps) {
  return (
    <label
      htmlFor={questionId}
      className="fb-text-heading fb-mb-1.5 fb-block fb-text-base fb-font-semibold fb-leading-6">
      <div
        className={`fb-flex fb-items-center ${alignTextCenter ? "fb-justify-center" : "fb-justify-between"}`}>
        <div className="text-base leading-relaxed">
          <span className="inline">
            {headline}
            {tooltipContent && (
              <Tooltip content={tooltipContent}>
                <span className="relative top-[1px] ml-1 inline-block cursor-help align-middle">
                  <CircleHelp size={16} className="inline-block opacity-60" />
                </span>
              </Tooltip>
            )}
          </span>
        </div>

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
