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

export const WorkflowsListLoading = () => (
  <PageContentWrapper>
    <HeaderSkeleton cta tabs />
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
  </PageContentWrapper>
);

export const WorkflowBuilderLoading = () => (
  <PageContentWrapper className="space-y-4">
    <HeaderSkeleton cta tabs />
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
  </PageContentWrapper>
);

export const WorkspaceWorkflowRunsLoading = () => (
  <PageContentWrapper>
    <HeaderSkeleton tabs />
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
