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
      <p className="text-md from-teal mx-auto mb-3 max-w-2xl bg-gradient-to-b to-teal-600 bg-clip-text font-semibold uppercase text-transparent sm:mt-4">
        {Teaser}
      </p>
      <h2 className="text-blue text-3xl font-bold tracking-tight dark:text-blue-100 sm:text-4xl">
        {Heading}
      </h2>
      <p className="mx-auto mt-3 max-w-2xl text-xl text-blue-500 dark:text-blue-300 sm:mt-4">{Subheading}</p>
    </div>
  );
}
