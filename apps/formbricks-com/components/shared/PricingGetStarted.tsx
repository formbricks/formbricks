import { Button } from "@formbricks/ui";

export const GetStartedWithPricing = ({ showDetailed }: { showDetailed: boolean }) => {
  return (
    <>
      <div className="flex items-center gap-x-4 px-4 pb-4 md:gap-4 md:px-16">
        <div className="w-1/3"></div>
        <div className="w-1/3 text-left text-sm text-slate-800 dark:text-slate-100">
          <p className="text-base font-semibold">Free</p>

          {showDetailed && (
            <p className="leading text-xs text-slate-500 dark:text-slate-400 md:text-base">
              General free usage on every product. Best for early stage startups and hobbyists
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
          <p className="text-base font-semibold"> Paid</p>
          {showDetailed && (
            <p className="leading text-xs text-slate-500 dark:text-slate-400 md:text-base">
              Formbricks with the next-generation features, Pay only for the tracked users.
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
