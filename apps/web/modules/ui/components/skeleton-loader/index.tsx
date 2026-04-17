import { Skeleton } from "@/modules/ui/components/skeleton";

type SkeletonLoaderProps = {
  type: "response" | "responseTable" | "summary";
};

export const SkeletonLoader = ({ type }: SkeletonLoaderProps) => {
  if (type === "summary") {
    return (
      <div
        className="rounded-xl border border-slate-200 bg-white shadow-sm"
        data-testid="skeleton-loader-summary">
        <Skeleton className="group space-y-4 rounded-xl bg-white p-6">
          <div className="space-y-4">
            <div className="flex gap-4">
              <div className="h-6 w-24 rounded-full bg-slate-200"></div>
              <div className="h-6 w-24 rounded-full bg-slate-200"></div>
            </div>
            <div className="flex h-12 w-full items-center justify-center rounded-full bg-slate-200 text-sm text-slate-500"></div>
            <div className="h-12 w-full rounded-full bg-slate-200"></div>
            <div className="h-12 w-full rounded-full bg-slate-200"></div>
          </div>
        </Skeleton>
      </div>
    );
  }

  if (type === "responseTable") {
    const renderTableCells = () => (
      <>
        <Skeleton className="h-4 w-4 rounded-xl bg-slate-400" />
        <Skeleton className="h-4 w-24 rounded-xl bg-slate-200" />
        <Skeleton className="h-4 w-32 rounded-xl bg-slate-200" />
        <Skeleton className="h-4 w-40 rounded-xl bg-slate-200" />
        <Skeleton className="h-4 w-40 rounded-xl bg-slate-200" />
        <Skeleton className="h-4 w-32 rounded-xl bg-slate-200" />
      </>
    );

    return (
      <div className="animate-pulse space-y-4" data-testid="skeleton-loader-response-table">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48 rounded-md bg-slate-300" />
          <div className="flex gap-2">
            <Skeleton className="h-8 w-8 rounded-md bg-slate-300" />
            <Skeleton className="h-8 w-8 rounded-md bg-slate-300" />
          </div>
        </div>
        <div className="overflow-hidden rounded-xl border border-slate-200">
          <div className="flex h-12 items-center gap-4 border-b border-slate-200 bg-slate-100 px-4">
            {renderTableCells()}
          </div>
          {Array.from({ length: 10 }, (_, i) => (
            <div
              key={i}
              className="flex h-12 items-center gap-4 border-b border-slate-100 px-4 last:border-b-0">
              {renderTableCells()}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (type === "response") {
    return (
      <div className="group space-y-4 rounded-lg bg-white p-6" data-testid="skeleton-loader-response">
        <div className="flex items-center space-x-4">
          <Skeleton className="h-12 w-12 flex-shrink-0 rounded-full bg-slate-200"></Skeleton>
          <Skeleton className="h-6 w-full rounded-full bg-slate-200"></Skeleton>
        </div>
        <div className="space-y-4">
          <Skeleton className="h-12 w-full rounded-full bg-slate-200"></Skeleton>
          <Skeleton className="flex h-12 w-full items-center justify-center rounded-full bg-slate-200 text-sm text-slate-500"></Skeleton>
          <Skeleton className="h-12 w-full rounded-full bg-slate-200"></Skeleton>
        </div>
      </div>
    );
  }
};
