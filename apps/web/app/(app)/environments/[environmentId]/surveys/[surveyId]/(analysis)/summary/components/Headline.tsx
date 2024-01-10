interface HeadlineProps {
  headline: string;
}

export default function Headline({ headline }: HeadlineProps) {
  return (
    <div className={"align-center flex justify-between gap-4 "}>
      <h3 className="pb-1 text-lg font-semibold text-slate-900 md:text-xl">{headline}</h3>
    </div>
  );
}
