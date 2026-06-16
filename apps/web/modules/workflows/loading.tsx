import { Skeleton } from "@/modules/ui/components/skeleton";

const RunsTableSkeleton = ({ showWorkflowColumn = false }: Readonly<{ showWorkflowColumn?: boolean }>) => {
  const runColumnSpan = showWorkflowColumn ? "col-span-3" : "col-span-4";
  const timeColumnSpan = showWorkflowColumn ? "col-span-2" : "col-span-3";

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="grid grid-cols-12 gap-4 border-b border-slate-200 bg-slate-100 px-4 py-3">
        <Skeleton className={`${runColumnSpan} h-4 rounded-md`} />
        {showWorkflowColumn ? <Skeleton className="col-span-2 h-4 rounded-md" /> : null}
        <Skeleton className="col-span-2 h-4 rounded-md" />
        <Skeleton className="col-span-3 h-4 rounded-md" />
        <Skeleton className={`${timeColumnSpan} h-4 rounded-md`} />
      </div>
      {[0, 1, 2].map((row) => (
        <div
          key={row}
          className="grid grid-cols-12 gap-4 border-b border-slate-100 px-4 py-4 last:border-b-0">
          <Skeleton className={`${runColumnSpan} h-4 rounded-md`} />
          {showWorkflowColumn ? <Skeleton className="col-span-2 h-4 rounded-md" /> : null}
          <Skeleton className="col-span-2 h-6 rounded-full" />
          <Skeleton className="col-span-3 h-4 rounded-md" />
          <Skeleton className={`${timeColumnSpan} h-4 rounded-md`} />
        </div>
      ))}
    </div>
  );
};

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

export const WorkspaceWorkflowRunsBodyLoading = () => <RunsTableSkeleton showWorkflowColumn />;

export const WorkflowBuilderBodyLoading = () => (
  <div className="flex min-h-[680px] flex-col gap-4 md:flex-row">
    <div className="relative min-h-[680px] min-w-0 flex-1 overflow-hidden rounded-lg border border-slate-200 bg-white bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:18px_18px]">
      <Skeleton className="absolute right-4 top-4 size-8 rounded-md" />
    </div>
    <aside className="h-[360px] overflow-hidden md:h-auto md:w-[360px] md:shrink-0">
      <div className="h-full w-full space-y-6 overflow-y-auto rounded-lg border border-slate-200 bg-white p-6 md:w-[360px]">
        <div className="space-y-2">
          <Skeleton className="h-7 w-40 rounded-md" />
          <Skeleton className="h-4 w-24 rounded-md" />
        </div>
        <div className="space-y-6">
          <Skeleton className="h-16 rounded-md" />
          <Skeleton className="h-16 rounded-md" />
          <Skeleton className="h-28 rounded-lg" />
        </div>
      </div>
    </aside>
  </div>
);

export const WorkflowRunsBodyLoading = () => <RunsTableSkeleton />;
