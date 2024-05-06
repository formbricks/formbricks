import { HelpCircleIcon, TagIcon } from "lucide-react";

import { Button } from "@formbricks/ui/Button";

export default function Loading() {
  return (
    <>
      <div className="mb-6 text-right">
        <div className="mb-6 flex items-center justify-end text-right">
          <Button
            variant="secondary"
            className="pointer-events-none animate-pulse cursor-not-allowed select-none">
            <HelpCircleIcon className="mr-2 h-4 w-4" />
            Loading Attributes
          </Button>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200">
        <div className="grid h-12 grid-cols-5 content-center rounded-lg bg-slate-100 text-left text-sm font-semibold text-slate-900">
          <div className="col-span-3 pl-6 ">Name</div>
          <div className="text-center">Created</div>
          <div className="text-center">Last Updated</div>
        </div>
      </div>

      {[...Array(3)].map((_, index) => (
        <div key={index} className="m-2 grid h-16  grid-cols-5 content-center rounded-lg hover:bg-slate-100">
          <div className="col-span-3 flex items-center pl-6 text-sm">
            <div className="flex items-center">
              <div className="h-10 w-10 flex-shrink-0">
                <TagIcon className="h-8 w-8 flex-shrink-0 animate-pulse text-slate-500" />
              </div>
              <div className="ml-4 text-left">
                <div className="font-medium text-slate-900">
                  <div className="mt-0 h-4 w-48 animate-pulse rounded-full bg-slate-200"></div>
                </div>
                <div className="mt-1 text-xs text-slate-400">
                  <div className="h-2 w-24 animate-pulse rounded-full bg-slate-200"></div>
                </div>
              </div>
            </div>
          </div>

          <div className="my-auto whitespace-nowrap text-center text-sm text-slate-500">
            <div className="m-4 h-4 animate-pulse rounded-full bg-slate-200"></div>
          </div>
          <div className="my-auto whitespace-nowrap text-center text-sm text-slate-500">
            <div className="m-4 h-4 animate-pulse rounded-full bg-slate-200"></div>
          </div>
        </div>
      ))}
    </>
  );
}
