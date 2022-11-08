interface Props {
  headingPt1: string;
  headingTeal?: string;
  headingPt2?: string;
  subheading?: string;
  children?: React.ReactNode;
}

export default function HeroTitle({ headingPt1, headingTeal, headingPt2, subheading, children }: Props) {
  return (
    <div className="px-4 py-16 text-center sm:px-6 md:px-8 md:py-28">
      <h1 className="text-4xl font-bold tracking-tight text-blue dark:text-blue-100 sm:text-4xl md:text-5xl">
        <span className="inline ">{headingPt1}</span>{" "}
        <span className="inline text-transparent from-teal bg-gradient-to-b to-teal-600 bg-clip-text xl:inline">
          {headingTeal}
        </span>{" "}
        <span className="inline ">{headingPt2}</span>
      </h1>
      <p className="max-w-md mx-auto mt-3 text-base text-blue-500 dark:text-blue-300 sm:text-lg md:mt-5 md:max-w-2xl md:text-xl">
        {subheading}
      </p>
      <div className="max-w-md mx-auto mt-5 sm:flex sm:justify-center md:mt-8">{children}</div>
    </div>
  );
}
