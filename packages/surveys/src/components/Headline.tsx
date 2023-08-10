interface HeadlineProps {
  headline?: string;
  questionId: string;
  style?: any;
}

export default function Headline({ headline, questionId, style }: HeadlineProps) {
  return (
    <label
      htmlFor={questionId}
      className="fb-mb-1.5 fb-block fb-text-base fb-font-semibold fb-leading-6 fb-mr-8 fb-text-slate-900"
      style={style}>
      {headline}
    </label>
  );
}
