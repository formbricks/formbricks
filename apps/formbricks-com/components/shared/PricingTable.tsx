import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@formbricks/ui/Tooltip";
import { CheckIcon, XMarkIcon } from "@heroicons/react/24/outline";

export const PricingTable = ({ leadRow, pricing, endRow }) => {
  return (
    <div className="grid grid-cols-1 px-4 md:gap-4 md:px-16 ">
      <div className="rounded-xl px-4 md:px-12">
        <div className="flex items-center gap-x-4">
          <div className="w-1/3 text-left font-semibold text-slate-700 dark:text-slate-200 md:text-xl">
            {leadRow.title}
          </div>
          <div
            className="flex w-1/3 items-center justify-center text-center text-sm font-semibold
           text-slate-500 dark:text-slate-200 md:text-lg">
            {leadRow.free}
          </div>

          <div className="w-1/3 text-center font-semibold text-slate-700 dark:text-slate-200 md:text-lg">
            {leadRow.paid}
          </div>
        </div>
      </div>

      <div className="rounded-xl bg-slate-100 px-4 py-4 dark:bg-slate-800 md:px-12 ">
        {pricing.map((feature) => (
          <div key={feature.name} className="mb-8 flex items-center gap-x-4">
            <div className="w-1/3 text-left text-sm text-slate-700 dark:text-slate-200 md:text-base">
              {feature.name}
              {feature.addOnText && (
                <span className=" mx-2 bg-teal-100 p-1 text-xs text-slate-400 dark:bg-slate-700 dark:text-teal-500">
                  Addon
                </span>
              )}
            </div>
            <div className="flex w-1/3 items-center justify-center text-center text-sm text-slate-800 dark:text-slate-100">
              {feature.addOnText ? (
                <TooltipProvider delayDuration={50}>
                  <Tooltip>
                    <TooltipTrigger>
                      <u>{feature.free}</u>
                    </TooltipTrigger>
                    <TooltipContent side={"top"}>
                      <p className="py-2 text-center text-xs text-slate-500 dark:text-slate-400">
                        {feature.addOnText}
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ) : feature.free ? (
                <div className="h-6 w-6 rounded-full border border-green-300 bg-green-100 p-0.5 dark:border-green-600 dark:bg-green-900">
                  <CheckIcon className=" text-green-500 dark:text-green-300" />
                </div>
              ) : (
                <div className="h-6 w-6 rounded-full border border-red-300 bg-red-100 p-0.5 dark:border-red-500 dark:bg-red-300">
                  <XMarkIcon className="text-red-500 dark:text-red-600" />
                </div>
              )}
            </div>
            <div className="flex w-1/3 items-center justify-center text-center text-sm text-slate-800 dark:text-slate-100">
              {feature.addOnText ? (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <u>{feature.paid}</u>
                    </TooltipTrigger>
                    <TooltipContent side={"top"}>
                      <p className="py-2 text-center text-xs text-slate-500 dark:text-slate-400">
                        {feature.addOnText}
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ) : feature.paid ? (
                <div className="h-6 w-6 rounded-full border border-green-300 bg-green-100 p-0.5 dark:border-green-600 dark:bg-green-900">
                  <CheckIcon className="text-green-500 dark:text-green-300" />
                </div>
              ) : (
                <div className="h-6 w-6 rounded-full border border-red-300 bg-red-100 p-0.5 dark:border-red-600 dark:bg-red-900">
                  <XMarkIcon className="text-red-500 dark:text-red-600" />
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-xl px-4 md:px-12">
        <div className="flex items-center gap-x-4">
          <div className="w-1/3 text-left text-sm font-semibold text-slate-700 dark:text-slate-200 md:text-base">
            {endRow.title}
          </div>
          <div className="flex w-1/3 items-center justify-center text-center text-sm font-semibold text-slate-700 dark:text-slate-200 md:text-base">
            <span>{endRow.free}</span>
          </div>

          <div className="w-1/3 text-center text-sm font-semibold text-slate-700 dark:text-slate-200 md:text-base">
            {endRow.paid}
          </div>
        </div>
      </div>
    </div>
  );
};
