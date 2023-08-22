import clsx from "clsx";

interface Props {
  teaser?: string;
  heading: string;
  subheading?: string;
  closer?: boolean;
}

export default function HeadingCentered({ teaser, heading, subheading, closer }: Props) {
  return (
    <div className={clsx(closer ? "pt-16 lg:pt-24" : "pt-24 lg:pt-40", "px-2 pb-4 text-center md:pb-12")}>
      <p className="text-md text-brand-dark dark:text-brand-light mx-auto mb-3 max-w-2xl font-semibold uppercase sm:mt-4">
        {teaser}
      </p>
      <h2 className="text-3xl font-bold tracking-tight text-slate-800 dark:text-slate-100 sm:text-4xl">
        {heading}
      </h2>
      <p className="mx-auto mt-3 max-w-3xl text-xl text-slate-500 dark:text-slate-300 sm:mt-4">
        {subheading}
      </p>
    </div>
  );
}
