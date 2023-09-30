interface HeadlineProps {
  headline?: string;
  questionId: string;
  style?: any;
}

export default function Headline({ headline, questionId, style }: HeadlineProps) {
  return (
    <label
      htmlFor={questionId}
      className="mb-1.5 mr-8 block text-base font-semibold leading-6 text-[var(--fb-headline-color)]"
      style={style}>
      {headline}
    </label>
  );
}
