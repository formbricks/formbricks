interface HeadlineProps {
  headline?: string;
  questionId: string;
  style?: any;
  required?: boolean;
}

export default function Headline({ headline, questionId, style, required = true }: HeadlineProps) {
  return (
    <label
      htmlFor={questionId}
      className="mb-1.5 block text-base font-semibold leading-6 text-[--fb-heading-color]"
      style={style}>
      <div className={"mr-[3ch] flex items-center justify-between"} style={style}>
        {headline}
        {!required && (
          <span className="self-start text-sm	font-normal leading-7 text-[--fb-info-text-color]" tabIndex={-1}>
            Optional
          </span>
        )}
      </div>
    </label>
  );
}
