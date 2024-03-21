import { Button } from "@formbricks/ui/Button";

export const GetStartedWithPricing = ({ showDetailed }: { showDetailed: boolean }) => {
  return (
    <>
      <div className="flex items-center gap-x-4 px-4 pb-4 md:gap-4 md:px-16">
        <div className="w-1/3"></div>
        <div className="w-1/3 text-left text-sm text-slate-800 dark:text-slate-100">
          <p className="text-base font-semibold text-slate-800">
            Community Edition
            <span className="ml-2 rounded-full bg-slate-700 px-3 py-0.5 text-sm text-slate-50">Free</span>
          </p>

          {showDetailed && (
            <p className="leading text-xs text-slate-500 md:text-base dark:text-slate-400">
              Covers 95% of all features. Great for startups, hobbyists and to get started. Free forever.
            </p>
          )}

          <Button
            className="mt-4 w-full justify-center"
            variant="secondary"
            onClick={() => {
              window.open("https://app.formbricks.com/", "_blank");
            }}>
            Get started - free
          </Button>
        </div>
        <div className="w-1/3 text-left text-sm text-slate-800 dark:text-slate-100">
          <p className="text-base font-semibold text-slate-800">
            {" "}
            Enterprise Edition{" "}
            <span className="ml-2 rounded-full bg-slate-700 px-3 py-0.5 text-sm text-slate-50">Freemium</span>
          </p>
          {showDetailed && (
            <p className="leading text-xs text-slate-500 md:text-base dark:text-slate-400">
              Includes all features with unlimited usage. Free credits every month to get started.
            </p>
          )}

          <Button
            className="mt-4 w-full justify-center"
            variant="highlight"
            onClick={() => {
              window.open("https://app.formbricks.com/", "_blank");
            }}>
            Get started - free
          </Button>
        </div>
      </div>
      <div className="my-12"></div>
    </>
  );
};
