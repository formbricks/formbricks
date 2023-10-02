interface HeadlineProps {
  headline?: string;
  questionId: string;
  style?: any;
  required?: boolean;
}

export default function Headline({ headline, questionId, style, required = true }: HeadlineProps) {
  return (
    <label htmlFor={questionId} className="mb-1.5 block text-base font-semibold leading-6 text-slate-900">
      <div className={"flex justify-between gap-4"} style={style}>
        {headline}
        {!required && (
          <span className="self-start font-light text-gray-500" tabIndex={-1}>
            Optional
          </span>
        )}
      </div>
    </label>
  );
}
