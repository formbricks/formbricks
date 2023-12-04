interface HeadlineProps {
  headline?: string;
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
      <div className={`flex items-center  ${alignTextCenter ? "justify-center" : "justify-between"}`}>
        {headline}
        {!required && (
          <span className="text-info-text ml-2 self-start text-sm font-normal leading-7" tabIndex={-1}>
            Optional
          </span>
        )}
      </div>
    </label>
  );
}
