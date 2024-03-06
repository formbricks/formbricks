import SalesCTA from "@/components/salespage/SalesCTA";

interface Props {
  headline: string;
  subheadline: string;
}

export default function SalesBreaker({ headline, subheadline }: Props) {
  return (
    <div className="xs:mx-auto xs:w-full mx-4 my-4  mt-28 max-w-6xl rounded-xl bg-gradient-to-br from-slate-200 to-slate-300 md:mb-0 dark:from-slate-800 dark:via-slate-800 dark:to-slate-700">
      <div className="relative px-4 py-8 sm:px-6 sm:pb-12 sm:pt-8 lg:px-8 lg:pt-12">
        <div className="xs:block xs:absolute xs:right-10 hidden md:top-1/2 md:-translate-y-1/2">
          <SalesCTA />
        </div>
        <h2 className="mt-4 text-2xl font-bold tracking-tight text-slate-800 lg:text-3xl">{headline}</h2>
        <h4 className="text-md mt-4 max-w-3xl text-slate-500 lg:text-lg dark:text-slate-300">
          {subheadline}
        </h4>
        <div className="xs:hidden mt-4">
          <SalesCTA />
        </div>
      </div>
    </div>
  );
}
