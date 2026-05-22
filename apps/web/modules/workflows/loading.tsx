import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";

const SkeletonBlock = ({ className }: Readonly<{ className: string }>) => (
  <div className={`animate-pulse rounded-md bg-slate-200 ${className}`} />
);

const WorkflowLoadingHeader = ({
  cta = false,
  tabs = false,
}: Readonly<{ cta?: boolean; tabs?: boolean }>) => {
  return (
    <div className="border-b border-slate-200">
      <div className="flex items-center justify-between gap-4 pb-4">
        <SkeletonBlock className="h-9 w-56" />
        {cta ? <SkeletonBlock className="h-9 w-36" /> : null}
      </div>
      {tabs ? (
        <div className="flex animate-pulse gap-6 pb-3">
          <div className="h-4 w-20 rounded bg-slate-200" />
          <div className="h-4 w-16 rounded bg-slate-200" />
        </div>
      ) : null}
    </div>
  );
};

const WorkflowRunsTableSkeleton = ({
  showWorkflowColumn = false,
}: Readonly<{ showWorkflowColumn?: boolean }>) => {
  const runColumnSpan = showWorkflowColumn ? "col-span-2" : "col-span-3";

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="grid grid-cols-12 gap-4 border-b border-slate-200 bg-slate-50 px-4 py-3">
        <SkeletonBlock className={`${runColumnSpan} h-4`} />
        {showWorkflowColumn ? <SkeletonBlock className="col-span-2 h-4" /> : null}
        <SkeletonBlock className="col-span-2 h-4" />
        <SkeletonBlock className="col-span-3 h-4" />
        <SkeletonBlock className="col-span-2 h-4" />
        <SkeletonBlock className="col-span-1 h-4" />
      </div>
      {[0, 1, 2, 3].map((row) => (
        <div
          key={row}
          className="grid grid-cols-12 gap-4 border-b border-slate-100 px-4 py-4 last:border-b-0">
          <SkeletonBlock className={`${runColumnSpan} h-4`} />
          {showWorkflowColumn ? <SkeletonBlock className="col-span-2 h-4" /> : null}
          <SkeletonBlock className="col-span-2 h-6 rounded-full" />
          <SkeletonBlock className="col-span-3 h-4" />
          <SkeletonBlock className="col-span-2 h-4" />
          <SkeletonBlock className="col-span-1 h-4" />
        </div>
      ))}
    </div>
  );
};

export const WorkflowsListLoading = () => {
  return (
    <PageContentWrapper>
      <WorkflowLoadingHeader cta />
      <div className="flex-col space-y-3">
        <div className="mt-6 grid w-full grid-cols-10 place-items-center gap-3 px-6 pr-8">
          <SkeletonBlock className="col-span-3 h-4 place-self-start" />
          <SkeletonBlock className="col-span-2 h-4" />
          <SkeletonBlock className="col-span-2 h-4" />
          <SkeletonBlock className="col-span-1 h-4" />
          <SkeletonBlock className="col-span-2 h-4" />
        </div>
        {[0, 1, 2, 3].map((row) => (
          <div
            key={row}
            className="grid w-full grid-cols-10 place-items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 pr-8 shadow-sm">
            <div className="col-span-3 flex w-full flex-col gap-2 justify-self-start">
              <SkeletonBlock className="h-4 w-44" />
              <SkeletonBlock className="h-3 w-64" />
            </div>
            <SkeletonBlock className="col-span-2 h-6 w-20 rounded-full" />
            <SkeletonBlock className="col-span-2 h-4 w-24" />
            <SkeletonBlock className="col-span-1 h-4 w-16" />
            <SkeletonBlock className="col-span-2 h-4 w-32" />
          </div>
        ))}
      </div>
    </PageContentWrapper>
  );
};

export const WorkspaceWorkflowRunsLoading = () => {
  return (
    <PageContentWrapper>
      <WorkflowLoadingHeader />
      <WorkflowRunsTableSkeleton showWorkflowColumn />
    </PageContentWrapper>
  );
};

export const WorkflowRunsLoading = () => {
  return (
    <PageContentWrapper>
      <WorkflowLoadingHeader tabs />
      <WorkflowRunsTableSkeleton />
    </PageContentWrapper>
  );
};

export const WorkflowBuilderLoading = () => {
  return (
    <PageContentWrapper className="space-y-4">
      <WorkflowLoadingHeader cta tabs />
      <div className="grid max-w-3xl gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <SkeletonBlock className="h-4 w-28" />
          <SkeletonBlock className="h-10 w-full" />
        </div>
        <div className="space-y-2">
          <SkeletonBlock className="h-4 w-40" />
          <SkeletonBlock className="h-10 w-full" />
        </div>
      </div>
      <div className="relative h-[680px] overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
        <div className="absolute left-4 top-4 z-10 flex items-center gap-2 rounded-lg border border-slate-200 bg-white/95 p-2 shadow-card-sm">
          <SkeletonBlock className="h-8 w-36" />
          <SkeletonBlock className="h-8 w-28" />
        </div>
        <div className="absolute left-1/2 top-24 h-32 w-72 -translate-x-1/2 rounded-lg border border-slate-200 bg-white p-3 shadow-card-sm">
          <SkeletonBlock className="h-9 w-full" />
          <SkeletonBlock className="mt-4 h-4 w-56" />
          <SkeletonBlock className="mt-2 h-4 w-48" />
        </div>
        <div className="absolute left-1/2 top-72 h-32 w-72 -translate-x-1/2 rounded-lg border border-slate-200 bg-white p-3 shadow-card-sm">
          <SkeletonBlock className="h-9 w-full" />
          <SkeletonBlock className="mt-4 h-4 w-48" />
          <SkeletonBlock className="mt-2 h-4 w-40" />
        </div>
        <div className="absolute bottom-4 right-4 top-4 w-96 rounded-lg border border-slate-200 bg-white p-4 shadow-card-md">
          <SkeletonBlock className="h-5 w-40" />
          <SkeletonBlock className="mt-6 h-4 w-28" />
          <SkeletonBlock className="mt-2 h-10 w-full" />
          <SkeletonBlock className="mt-5 h-4 w-32" />
          <SkeletonBlock className="mt-2 h-10 w-full" />
        </div>
      </div>
    </PageContentWrapper>
  );
};

export const WorkflowRunDetailLoading = () => {
  return (
    <PageContentWrapper>
      <WorkflowLoadingHeader tabs />
      <div className="grid grid-cols-12 gap-6">
        <section className="col-span-4 space-y-6 rounded-lg border border-slate-200 bg-white p-4">
          <SkeletonBlock className="h-4 w-20" />
          <SkeletonBlock className="h-6 w-24 rounded-full" />
          <SkeletonBlock className="h-4 w-28" />
          <SkeletonBlock className="h-4 w-48" />
          <SkeletonBlock className="h-4 w-24" />
          <SkeletonBlock className="h-4 w-56" />
        </section>
        <section className="col-span-8 space-y-4">
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <SkeletonBlock className="h-5 w-36" />
            <SkeletonBlock className="mt-3 h-48 w-full rounded-lg" />
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <SkeletonBlock className="h-5 w-32" />
            <SkeletonBlock className="mt-3 h-32 w-full rounded-lg" />
            <SkeletonBlock className="mt-3 h-32 w-full rounded-lg" />
          </div>
        </section>
      </div>
    </PageContentWrapper>
  );
};
