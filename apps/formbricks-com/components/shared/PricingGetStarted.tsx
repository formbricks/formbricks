import { Button } from "@formbricks/ui";

export const GetStartedWithPricing = () => {
  return (
    <>
      <div className="flex items-center gap-x-4 bg-slate-50 px-4 pb-4 dark:bg-slate-900 md:gap-4 md:px-16">
        <div className="w-1/3"></div>
        <div className="w-1/3 text-left text-sm text-slate-800">
          <p className="font-semibold">Free</p>
          <p className="text-xs md:text-base">
            General free usage on every product. Best for early stage startups and hobbyists
          </p>
          <Button
            className="mt-4 w-full justify-center bg-slate-300 px-4 text-xs shadow-sm hover:bg-slate-200 dark:bg-slate-600 dark:hover:bg-slate-500 md:text-lg"
            variant={"secondary"}>
            Get started - free
          </Button>
        </div>
        <div className="w-1/3 text-left text-sm text-slate-800">
          <p className="font-semibold"> Paid</p>
          <p className="text-xs md:text-base">
            Formbricks with the next-generation features, Pay only for the tracked users.
          </p>

          <Button
            className="mt-4 w-full justify-center px-4 text-xs shadow-sm md:text-lg"
            variant={"highlight"}>
            Get started - free
          </Button>
        </div>
      </div>
      <div className="my-12"></div>
    </>
  );
};
