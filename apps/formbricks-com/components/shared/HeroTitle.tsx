interface Props {
  headingPt1: string;
  headingTeal?: string;
  headingPt2?: string;
  subheading?: string;
  children?: React.ReactNode;
}

export default function HeroTitle({ headingPt1, headingTeal, headingPt2, subheading, children }: Props) {
  return (
    <div className="px-4  text-center sm:px-6 lg:px-8 ">
      <h1 className="text-3xl font-bold tracking-tight text-slate-800 sm:text-4xl md:text-5xl dark:text-slate-200">
        <span className="xl:inline">{headingPt1}</span>{" "}
        <span className="bg-gradient-to-b from-slate-900 to-slate-800 bg-clip-text text-transparent xl:inline">
          {headingTeal}
        </span>{" "}
        <span className="inline ">{headingPt2}</span>
      </h1>
      <p className="mx-auto mt-3 max-w-md text-base text-slate-500 sm:text-lg md:mt-5 md:max-w-2xl md:text-xl dark:text-slate-300">
        {subheading}
      </p>
      <div className="mx-auto mt-5 max-w-md sm:flex sm:justify-center md:mt-8">{children}</div>
    </div>
  );
}
