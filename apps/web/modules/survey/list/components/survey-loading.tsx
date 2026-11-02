"use client";

/** The first-load placeholder: the toolbar and a table's worth of rows, so nothing shifts on arrival. */
export const SurveyLoading = () => {
  return (
    <div className="space-y-3" aria-hidden="true">
      <div className="flex h-8 animate-pulse items-center gap-2">
        <div className="size-8 rounded-md bg-slate-200" />
        <div className="h-8 w-56 rounded-md bg-slate-200" />
        <div className="size-8 rounded-md bg-slate-200" />
      </div>
      <div className="animate-pulse overflow-hidden rounded-xl border border-slate-200 bg-white">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="flex items-center gap-6 border-b border-slate-100 px-4 py-3 last:border-0">
            <div className="h-4 w-48 rounded bg-slate-300" />
            <div className="h-4 w-20 rounded bg-slate-200" />
            <div className="h-4 w-12 rounded bg-slate-200" />
            <div className="h-4 w-16 rounded bg-slate-200" />
            <div className="h-4 w-24 rounded bg-slate-200" />
            <div className="h-4 w-24 rounded bg-slate-200" />
          </div>
        ))}
      </div>
    </div>
  );
};
