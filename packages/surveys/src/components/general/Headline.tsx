import { TI18nString } from "@formbricks/types/surveys";

interface HeadlineProps {
  headline?: TI18nString | string;
  questionId: string;
  required?: boolean;
  alignTextCenter?: boolean;
}

export default function Headline({
  headline,
  questionId,
  required = true,
  alignTextCenter = false,
}: HeadlineProps) {
  return (
    <label htmlFor={questionId} className="text-heading mb-1.5 block text-base font-semibold leading-6">
      <div
        className={`flex items-center  ${alignTextCenter ? "justify-center" : "mr-[3ch] justify-between"}`}>
        {headline}
        {!required && (
          <span className="text-info-text self-start	text-sm font-normal leading-7" tabIndex={-1}>
            Optional
          </span>
        )}
      </div>
    </label>
  );
}
