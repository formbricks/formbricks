import { CheckIcon, XIcon } from "lucide-react";

import { Button } from "@formbricks/ui/Button";

export const PricingTable = ({ leadRow, pricing, endRow }) => {
  return (
    <div className="mx-auto grid max-w-4xl grid-cols-1 md:gap-4">
      <div className="rounded-xl px-4 pb-4 md:px-12 md:pb-0">
        <div className="flex items-center gap-x-4">
          <div className="w-1/3 text-left font-semibold text-slate-700 md:text-xl dark:text-slate-200">
            {leadRow.title}
            {/*             <span className="hidden pl-2 text-sm font-normal text-slate-600 lg:inline-block">
              {leadRow.comparison}
            </span> */}
          </div>
          <div className=" w-1/3 text-center font-medium text-slate-600 dark:text-slate-200">
            {leadRow.free}
          </div>

          <div className="w-1/3 text-center  font-medium text-slate-600 dark:text-slate-200">
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
            <div className="flex w-1/3 items-center justify-center">
              {typeof feature.free === "string" ? (
                <span className="text-center text-sm font-medium leading-4 text-slate-600 md:text-base">
                  {feature.free}
                </span>
              ) : feature.free ? (
                <CheckIcon className="rounded-full border border-green-300 bg-green-100 p-0.5 text-green-500 dark:border-green-600 dark:bg-green-900 dark:text-green-300" />
              ) : (
                <XIcon className="rounded-full border border-red-300 bg-red-100 p-0.5 text-red-500 dark:border-red-500 dark:bg-red-300 dark:text-red-600" />
              )}
            </div>
            <div className="flex w-1/3 items-center justify-center">
              {typeof feature.free === "string" ? (
                <span className="text-center text-sm font-medium leading-4 text-slate-600 md:text-base">
                  {feature.paid}
                </span>
              ) : feature.paid ? (
                <CheckIcon className="rounded-full border border-green-300 bg-green-100 p-0.5 text-green-500 dark:border-green-600 dark:bg-green-900 dark:text-green-300" />
              ) : (
                <XIcon className="rounded-full border border-red-300 bg-red-100 p-0.5 text-red-500 dark:border-red-500 dark:bg-red-300 dark:text-red-600" />
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-xl px-4 md:px-12">
        <div className="flex items-center gap-x-4">
          <div className="w-1/3"></div>
          <div className="w-1/3 pt-4 text-center text-sm font-semibold text-slate-700 md:pt-0 md:text-xl dark:text-slate-200">
            <span>{endRow.free}</span>
            <Button
              variant="secondary"
              className="mt-4 hidden w-full py-2 md:block"
              href="https://app.formbricks.com/auth/signup">
              Get started
            </Button>
          </div>

          <div className="w-1/3 pt-4 text-center text-sm font-semibold text-slate-700 md:pt-0 md:text-xl dark:text-slate-200">
            {endRow.paid}
            <Button
              variant="darkCTA"
              className="mt-4 hidden w-full py-2 md:block"
              href="https://app.formbricks.com/auth/signup">
              Get started
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
