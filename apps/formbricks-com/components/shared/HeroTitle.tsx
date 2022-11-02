interface Props {
  HeadingPt1: string;
  HeadingTeal: string;
  HeadingPt2: string;
  Subheading?: string;
  children?: React.ReactNode;
}

export default function HeroTitle({ HeadingPt1, HeadingTeal, HeadingPt2, Subheading, children }: Props) {
  return (
    <div className="px-4 py-20 text-center sm:px-6 lg:px-8 lg:py-28">
      <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100 sm:text-4xl md:text-5xl">
        <span className="block xl:inline">{HeadingPt1}</span>{" "}
        <span className="block text-transparent bg-gradient-to-b from-teal-400 to-teal-500 bg-clip-text xl:inline">
          {HeadingTeal}
        </span>{" "}
        <span className="block xl:inline">{HeadingPt2}</span>
      </h1>
      <p className="max-w-md mx-auto mt-3 text-base text-slate-500 dark:text-slate-300 sm:text-lg md:mt-5 md:max-w-2xl md:text-xl">
        {Subheading}
      </p>
      <div className="max-w-md mx-auto mt-5 sm:flex sm:justify-center md:mt-8">{children}</div>
    </div>
  );
}
