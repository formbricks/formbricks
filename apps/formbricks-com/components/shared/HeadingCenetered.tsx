interface Props {
  Teaser?: string;
  Heading: string;
  Subheading?: string;
}

export default function HeadingCentered({ Teaser, Heading, Subheading }: Props) {
  return (
    <div className="pt-40 pb-12 text-center">
      <p className="max-w-2xl mx-auto mb-3 font-semibold text-teal-500 uppercase text-md sm:mt-4">{Teaser}</p>
      <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100 sm:text-4xl">
        {Heading}
      </h2>
      <p className="max-w-2xl mx-auto mt-3 text-xl text-slate-500 dark:text-slate-300 sm:mt-4">
        {Subheading}
      </p>
    </div>
  );
}
