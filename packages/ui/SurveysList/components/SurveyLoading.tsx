"use client";

export const SurveyLoading = () => {
  return (
    <div className="grid h-full w-full animate-pulse grid-cols-2 place-content-stretch gap-4 lg:grid-cols-3 2xl:grid-cols-5">
      {[1, 2, 3, 4, 5].map((i) => {
        return (
          <div
            key={i}
            className="relative col-span-1 flex h-44 flex-col justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-all ease-in-out">
            <div className="flex w-full items-center justify-between">
              <div className="h-4 w-24 rounded-xl bg-slate-300"></div>
              <div className="h-8 w-8 rounded-md bg-slate-300"></div>
            </div>
            <div className="flex flex-col gap-2">
              <div className="h-4 w-24 rounded-xl bg-slate-400"></div>
              <div className="h-4 w-20 rounded-xl bg-slate-400"></div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
