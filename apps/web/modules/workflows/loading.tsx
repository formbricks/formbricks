import { Skeleton } from "@/modules/ui/components/skeleton";

const RunsTableSkeleton = () => (
  <div className="w-full overflow-x-auto rounded-xl border border-slate-200">
    <div className="grid grid-cols-12 gap-4 border-b border-slate-200 px-4 py-3">
      <Skeleton className="col-span-6 h-4 rounded-md" />
      <Skeleton className="col-span-2 h-4 rounded-md" />
      <Skeleton className="col-span-2 h-4 rounded-md" />
      <Skeleton className="col-span-2 h-4 rounded-md" />
    </div>
    {[0, 1, 2].map((row) => (
      <div key={row} className="grid grid-cols-12 gap-4 border-b border-slate-100 px-4 py-3 last:border-b-0">
        <Skeleton className="col-span-6 h-4 rounded-md" />
        <Skeleton className="col-span-2 h-6 rounded-full" />
        <Skeleton className="col-span-2 h-4 rounded-md" />
        <Skeleton className="col-span-2 h-4 rounded-md" />
      </div>
    ))}
  </div>
);

export const WorkflowsListBodyLoading = () => (
  <div className="space-y-3">
    <div className="mt-6 grid w-full grid-cols-8 place-items-center gap-3 px-6 pr-8">
      <Skeleton className="col-span-2 h-4 w-full rounded-md" />
      <Skeleton className="col-span-1 h-4 w-full rounded-md" />
      <Skeleton className="col-span-1 h-4 w-full rounded-md" />
      <Skeleton className="col-span-1 h-4 w-full rounded-md" />
      <Skeleton className="col-span-2 h-4 rounded-md" />
    </div>
    {[0, 1, 2].map((row) => (
      <div
        key={row}
        className="grid w-full grid-cols-8 place-items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 pr-8">
        <div className="col-span-2 w-full">
          <Skeleton className="h-4 w-44 rounded-md" />
        </div>
        <Skeleton className="col-span-1 h-6 w-20 rounded-full" />
        <Skeleton className="col-span-1 h-4 w-full rounded-md" />
        <Skeleton className="col-span-1 h-4 w-full rounded-md" />
        <Skeleton className="col-span-2 h-4 rounded-md" />
      </div>
    ))}
  </div>
);

export const WorkspaceWorkflowRunsBodyLoading = () => <RunsTableSkeleton />;

export const WorkflowBuilderBodyLoading = () => (
  <div className="flex flex-col gap-4 rounded-lg bg-slate-100 p-4">
    <div className="flex flex-wrap items-end gap-4">
      <div className="flex min-w-[200px] flex-1 flex-col gap-2">
        <Skeleton className="h-4 w-16 rounded-md" />
        <Skeleton className="h-10 w-full rounded-md bg-white" />
      </div>
      <div className="flex min-w-[240px] flex-1 flex-col gap-2">
        <Skeleton className="h-4 w-20 rounded-md" />
        <Skeleton className="h-10 w-full rounded-md bg-white" />
      </div>
      <div className="flex items-center gap-2 pb-0.5">
        <Skeleton className="h-8 w-20 rounded-md" />
        <Skeleton className="h-8 w-20 rounded-md" />
        <Skeleton className="h-8 w-14 rounded-md" />
      </div>
    </div>
    <div className="flex min-h-[680px] gap-4">
      <div className="relative min-h-[680px] min-w-0 flex-1 overflow-hidden rounded-lg border border-slate-200 bg-white">
        <Skeleton className="absolute right-4 top-4 h-9 w-20 rounded-md" />
        <div className="absolute inset-x-0 bottom-4 flex justify-center gap-2">
          <Skeleton className="size-10 rounded-md" />
          <Skeleton className="size-10 rounded-md" />
          <Skeleton className="size-10 rounded-md" />
          <Skeleton className="size-10 rounded-md" />
        </div>
      </div>
      <aside className="flex w-[320px] shrink-0 flex-col gap-3">
        <Skeleton className="size-8 rounded-md" />
        <div className="space-y-1 rounded-lg border border-slate-200 bg-white p-4">
          <Skeleton className="h-4 w-24 rounded-md" />
          <Skeleton className="h-3 w-32 rounded-md" />
          <Skeleton className="mt-3 h-10 rounded-md" />
        </div>
        <div className="space-y-1 rounded-lg border border-slate-200 bg-white p-4">
          <Skeleton className="h-4 w-20 rounded-md" />
          <Skeleton className="mt-3 h-6 w-32 rounded-md" />
        </div>
      </aside>
    </div>
  </div>
);

export const WorkflowRunsBodyLoading = () => <RunsTableSkeleton />;
