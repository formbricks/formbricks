import { Button } from "@formbricks/ui/Button";

export const GetStartedWithPricing = ({ showDetailed }: { showDetailed: boolean }) => {
  return (
    <>
      <div className="xs:flex-row flex flex-col items-center justify-center gap-x-4 px-4 pb-4 md:gap-4 md:px-16">
        <div className="text-left text-sm text-slate-800 dark:text-slate-100">
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
        <div className="xs:mt-0 mt-5 text-left text-sm text-slate-800 dark:text-slate-100">
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
