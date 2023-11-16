import { TI18nString } from "@formbricks/types/surveys";

interface HeadlineProps {
  headline?: TI18nString | string;
  questionId: string;
  style?: any;
  required?: boolean;
}

export default function Headline({ headline, questionId, style, required = true }: HeadlineProps) {
  return (
    <label
      htmlFor={questionId}
      className="text-heading mb-1.5 block text-base font-semibold leading-6"
      style={style}>
      <div className={"mr-[3ch] flex items-center justify-between"} style={style}>
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
