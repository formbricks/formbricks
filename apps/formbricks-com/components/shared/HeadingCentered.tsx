interface Props {
  teaser?: string;
  heading: string;
  subheading?: string;
}

export default function HeadingCentered({ teaser, heading, subheading }: Props) {
  return (
    <div className="mb-12 text-center">
      <p className="text-md text-brand-dark dark:text-brand-light mx-auto mb-3 max-w-2xl font-semibold uppercase sm:mt-4">
        {teaser}
      </p>
      <h2 className="text-3xl font-bold tracking-tight text-slate-800 sm:text-4xl dark:text-slate-100">
        {heading}
      </h2>
      <p className="mx-auto mt-3 max-w-3xl text-xl text-slate-500 sm:mt-4 dark:text-slate-300">
        {subheading}
      </p>
    </div>
  );
}
