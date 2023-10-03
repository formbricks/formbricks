interface HeadlineProps {
  headline: string;
  required?: boolean;
}

export default function Headline({ headline, required = true }: HeadlineProps) {
  return (
    <div className={"align-center flex justify-between gap-4 "}>
      <h3 className="pb-1 text-lg font-semibold text-slate-900 md:text-xl">{headline}</h3>
      {!required && (
        <span className="text-md pb-1 font-light leading-7 text-gray-500" tabIndex={-1}>
          Optional
        </span>
      )}
    </div>
  );
}
