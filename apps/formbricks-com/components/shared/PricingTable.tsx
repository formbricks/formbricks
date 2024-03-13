import { CheckIcon, XIcon } from "lucide-react";

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@formbricks/ui/Tooltip";

export const PricingTable = ({ leadRow, pricing, endRow }) => {
  return (
    <div className="grid grid-cols-1 px-4 md:gap-4 md:px-16 ">
      <div className="rounded-xl px-4 md:px-12">
        <div className="flex items-center gap-x-4">
          <div className="w-1/3 text-left font-semibold text-slate-700 md:text-xl dark:text-slate-200">
            {leadRow.title}
            <span className="pl-2 text-sm font-normal text-slate-600">{leadRow.comparison}</span>
          </div>
          <div
            className="flex w-1/3 items-center justify-center text-center text-sm font-semibold
           text-slate-500 md:text-lg dark:text-slate-200">
            {leadRow.free}
          </div>

          <div className="w-1/3 text-center font-semibold text-slate-700 md:text-lg dark:text-slate-200">
            {leadRow.paid}
          </div>
        </div>
      </div>

      <div className="rounded-xl bg-slate-100 px-4 py-4 md:px-12 dark:bg-slate-800 ">
        {pricing.map((feature) => (
          <div key={feature.name} className="mb-8 flex items-center gap-x-4">
            <div className="w-1/3 text-left text-sm text-slate-700 md:text-base dark:text-slate-200">
              {feature.name}
              {feature.addOnText && (
                <span className=" mx-3 rounded-full bg-emerald-200 px-2 text-xs text-slate-800 dark:bg-slate-700 dark:text-teal-500">
                  Addon
                </span>
              )}
              {feature.comingSoon && (
                <span className="mx-3 rounded-full bg-slate-200 px-2 text-xs text-slate-800 dark:bg-slate-700 dark:text-teal-500">
                  coming soon
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
                <CheckIcon className=" rounded-full border border-green-300 bg-green-100 p-0.5 text-green-500 dark:border-green-600 dark:bg-green-900 dark:text-green-300" />
              ) : (
                <XIcon className="rounded-full border border-red-300 bg-red-100 p-0.5 text-red-500 dark:border-red-500 dark:bg-red-300 dark:text-red-600" />
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
                <CheckIcon className=" rounded-full border border-green-300 bg-green-100 p-0.5 text-green-500 dark:border-green-600 dark:bg-green-900 dark:text-green-300" />
              ) : (
                <XIcon className="rounded-full border border-red-300 bg-red-100 p-0.5 text-red-500 dark:border-red-500 dark:bg-red-300 dark:text-red-600" />
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-xl px-4 md:px-12">
        <div className="flex items-center gap-x-4">
          <div className="w-1/3 text-left text-sm font-semibold text-slate-700 md:text-base dark:text-slate-200">
            {endRow.title}
          </div>
          <div className="flex w-1/3 items-center justify-center text-center text-sm font-semibold text-slate-700 md:text-base dark:text-slate-200">
            <span>{endRow.free}</span>
          </div>

          <div className="w-1/3 text-center text-sm font-semibold text-slate-700 md:text-base dark:text-slate-200">
            {endRow.paid}
          </div>
        </div>
      </div>
    </div>
  );
};
