import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { Skeleton } from "@/modules/ui/components/skeleton";

const HeaderSkeleton = ({ cta = false, tabs = false }: Readonly<{ cta?: boolean; tabs?: boolean }>) => (
  <div className="border-b border-slate-200">
    <div className="flex items-center justify-between gap-4 pb-4">
      <Skeleton className="h-9 w-56 rounded-md" />
      {cta ? <Skeleton className="h-9 w-40 rounded-md" /> : null}
    </div>
    {tabs ? (
      <div className="flex gap-6 pb-3">
        <Skeleton className="h-4 w-20 rounded-md" />
        <Skeleton className="h-4 w-16 rounded-md" />
      </div>
    ) : null}
  </div>
);

const RunsTableSkeleton = ({ showWorkflowColumn = false }: Readonly<{ showWorkflowColumn?: boolean }>) => {
  const runColumnSpan = showWorkflowColumn ? "col-span-2" : "col-span-3";

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="grid grid-cols-12 gap-4 border-b border-slate-200 bg-slate-50 px-4 py-3">
        <Skeleton className={`${runColumnSpan} h-4 rounded-md`} />
        {showWorkflowColumn ? <Skeleton className="col-span-2 h-4 rounded-md" /> : null}
        <Skeleton className="col-span-2 h-4 rounded-md" />
        <Skeleton className="col-span-3 h-4 rounded-md" />
        <Skeleton className="col-span-2 h-4 rounded-md" />
        <Skeleton className="col-span-1 h-4 rounded-md" />
      </div>
      {[0, 1, 2].map((row) => (
        <div
          key={row}
          className="grid grid-cols-12 gap-4 border-b border-slate-100 px-4 py-4 last:border-b-0">
          <Skeleton className={`${runColumnSpan} h-4 rounded-md`} />
          {showWorkflowColumn ? <Skeleton className="col-span-2 h-4 rounded-md" /> : null}
          <Skeleton className="col-span-2 h-6 rounded-full" />
          <Skeleton className="col-span-3 h-4 rounded-md" />
          <Skeleton className="col-span-2 h-4 rounded-md" />
          <Skeleton className="col-span-1 h-4 rounded-md" />
        </div>
      ))}
    </div>
  );
};

export const WorkflowsListLoading = () => (
  <PageContentWrapper>
    <HeaderSkeleton cta />
    <div className="space-y-3">
      <div className="grid grid-cols-12 gap-4 px-4">
        <Skeleton className="col-span-4 h-4 rounded-md" />
        <Skeleton className="col-span-2 h-4 rounded-md" />
        <Skeleton className="col-span-2 h-4 rounded-md" />
        <Skeleton className="col-span-2 h-4 rounded-md" />
        <Skeleton className="col-span-2 h-4 rounded-md" />
      </div>
      {[0, 1, 2].map((row) => (
        <div key={row} className="grid grid-cols-12 gap-4 rounded-lg border border-slate-200 bg-white p-4">
          <div className="col-span-4 space-y-2">
            <Skeleton className="h-4 w-44 rounded-md" />
            <Skeleton className="h-3 w-64 rounded-md" />
          </div>
          <Skeleton className="col-span-2 h-6 w-20 rounded-full" />
          <Skeleton className="col-span-2 h-4 rounded-md" />
          <Skeleton className="col-span-2 h-4 rounded-md" />
          <Skeleton className="col-span-2 h-4 rounded-md" />
        </div>
      ))}
    </div>
  </PageContentWrapper>
);

export const WorkflowBuilderLoading = () => (
  <PageContentWrapper className="space-y-4">
    <HeaderSkeleton cta tabs />
    <div className="grid max-w-4xl gap-4 md:grid-cols-2">
      <Skeleton className="h-16 rounded-md" />
      <Skeleton className="h-16 rounded-md" />
    </div>
    <div className="grid min-h-[680px] grid-cols-12 overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="col-span-8 bg-slate-50 p-6">
        <Skeleton className="h-10 w-72 rounded-lg" />
        <div className="mx-auto mt-24 flex w-80 flex-col items-center gap-8">
          <Skeleton className="h-28 w-full rounded-lg" />
          <Skeleton className="h-10 w-px rounded-none" />
          <Skeleton className="h-28 w-full rounded-lg" />
          <Skeleton className="h-10 w-px rounded-none" />
          <Skeleton className="h-28 w-full rounded-lg" />
        </div>
      </div>
      <div className="col-span-4 space-y-6 border-l border-slate-200 p-6">
        <Skeleton className="h-8 w-44 rounded-md" />
        <Skeleton className="h-16 rounded-md" />
        <Skeleton className="h-16 rounded-md" />
        <Skeleton className="h-24 rounded-lg" />
      </div>
    </div>
  </PageContentWrapper>
);

export const WorkspaceWorkflowRunsLoading = () => (
  <PageContentWrapper>
    <HeaderSkeleton />
    <RunsTableSkeleton showWorkflowColumn />
  </PageContentWrapper>
);

export const WorkflowRunsLoading = () => (
  <PageContentWrapper>
    <HeaderSkeleton tabs />
    <RunsTableSkeleton />
  </PageContentWrapper>
);

export const WorkflowRunDetailLoading = () => (
  <PageContentWrapper>
    <HeaderSkeleton tabs />
    <div className="grid grid-cols-12 gap-6">
      <section className="col-span-4 space-y-4 rounded-lg border border-slate-200 bg-white p-5">
        <Skeleton className="h-6 w-36 rounded-md" />
        <Skeleton className="h-4 w-28 rounded-md" />
        <Skeleton className="h-6 w-24 rounded-full" />
        <Skeleton className="h-4 w-48 rounded-md" />
      </section>
      <section className="col-span-8 space-y-6">
        <Skeleton className="h-64 rounded-lg" />
        <Skeleton className="h-64 rounded-lg" />
      </section>
    </div>
  </PageContentWrapper>
);
