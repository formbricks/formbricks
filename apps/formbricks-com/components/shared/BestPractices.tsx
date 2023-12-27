import BestPracticeNavigation from "./BestPracticeNavigation";

export default function InsightOppos() {
  return (
    <div className="pb-10 pt-12 md:pt-20">
      <div className="px-4 py-20 text-center sm:px-6 lg:px-8" id="best-practices">
        <h1 className="text-3xl font-bold tracking-tight text-slate-800 sm:text-4xl md:text-5xl dark:text-slate-200">
          Get started with{" "}
          <span className="from-brand-light to-brand-dark bg-gradient-to-b bg-clip-text text-transparent xl:inline">
            Best Practices
          </span>
        </h1>
        <p className="mx-auto mt-3 max-w-md text-base text-slate-500 sm:text-lg md:mt-5 md:max-w-3xl md:text-xl dark:text-slate-300">
          Run battle-tested approaches for qualitative user research in minutes.
        </p>
      </div>

      <BestPracticeNavigation />
    </div>
  );
}
