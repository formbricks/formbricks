import clsx from "clsx";

interface Props {
  Teaser?: string;
  Heading: string;
  Subheading?: string;
  closer?: boolean;
}

export default function HeadingCentered({ Teaser, Heading, Subheading, closer }: Props) {
  return (
    <div className={clsx(closer ? "pt-24" : "pt-40", "pb-12 text-center")}>
      <p className="max-w-2xl mx-auto mb-3 font-semibold text-transparent uppercase text-md from-teal bg-gradient-to-b to-teal-600 bg-clip-text sm:mt-4">
        {Teaser}
      </p>
      <h2 className="text-3xl font-bold tracking-tight text-blue dark:text-blue-100 sm:text-4xl">
        {Heading}
      </h2>
      <p className="max-w-2xl mx-auto mt-3 text-xl text-blue-500 dark:text-blue-300 sm:mt-4">{Subheading}</p>
    </div>
  );
}
