"use client";

export const SurveyLoading = () => {
  return (
    <div className="grid h-full w-full animate-pulse place-content-stretch gap-4">
      {[1, 2, 3, 4, 5].map((i) => {
        return (
          <div
            key={i}
            className="relative flex h-16 flex-col justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-xs transition-all ease-in-out">
            <div className="flex w-full items-center justify-between">
              <div className="h-4 w-32 rounded-xl bg-slate-400"></div>
              <div className="h-4 w-20 rounded-xl bg-slate-200"></div>
              <div className="h-4 w-20 rounded-xl bg-slate-200"></div>
              <div className="h-4 w-20 rounded-xl bg-slate-200"></div>
              <div className="h-4 w-20 rounded-xl bg-slate-200"></div>
              <div className="h-4 w-20 rounded-xl bg-slate-200"></div>
              <div className="h-8 w-8 rounded-md bg-slate-300"></div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
