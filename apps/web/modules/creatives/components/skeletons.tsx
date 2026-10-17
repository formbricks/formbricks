import { cn } from "@/lib/cn";

// Route-level loading states. Each mirrors the real page's grid closely enough that nothing jumps
// when the content arrives: same header height, same column widths, same panel order.

const Bone = ({ className }: Readonly<{ className?: string }>) => (
  <div className={cn("animate-pulse rounded-md bg-slate-200", className)} />
);

const PanelSkeleton = ({ rows }: Readonly<{ rows: number }>) => (
  <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
    <Bone className="h-4 w-24" />
    {Array.from({ length: rows }, (_, index) => (
      <div key={index} className="space-y-2">
        <Bone className="h-3 w-20" />
        <Bone className="h-10 w-full" />
      </div>
    ))}
  </div>
);

/** The On click panel's two choices: a radio, a title and a line of description each. */
const RadioCardSkeleton = () => (
  <div className="flex gap-3 rounded-lg border border-slate-200 p-4">
    <Bone className="size-4 rounded-full" />
    <div className="flex-1 space-y-2">
      <Bone className="h-4 w-28" />
      <Bone className="h-3 w-48" />
    </div>
  </div>
);

/**
 * Mirrors `CreativeEditor` on its Content tab: the header bar (back, name, type, status, Save and
 * Publish), the side column at the editor's widths with its four tabs, the content panels, and the
 * preview pane with its device toggle and frame.
 */
export const CreativeEditorSkeleton = () => (
  <div className="flex h-full flex-col">
    <div className="flex h-14 shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-4">
      <Bone className="size-8 shrink-0" />
      <Bone className="h-6 w-52 lg:w-64" />
      <Bone className="hidden h-4 w-28 sm:block" />
      <Bone className="h-6 w-20 rounded-full" />
      <div className="ml-auto flex gap-2">
        <Bone className="h-9 w-20" />
        <Bone className="h-9 w-28" />
      </div>
    </div>
    <div className="flex min-h-0 flex-1">
      <div className="flex w-full shrink-0 flex-col border-r border-slate-200 bg-white lg:w-[30rem] xl:w-[34rem]">
        <div className="flex h-12 shrink-0 items-center gap-7 border-b border-slate-200 px-6">
          {Array.from({ length: 4 }, (_, index) => (
            <Bone key={index} className="h-4 w-20" />
          ))}
        </div>
        <div className="min-h-0 flex-1 space-y-4 bg-slate-50 p-5">
          <PanelSkeleton rows={2} />
          <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
            <Bone className="h-4 w-20" />
            <RadioCardSkeleton />
            <RadioCardSkeleton />
          </div>
        </div>
      </div>
      <div className="hidden min-w-0 flex-1 flex-col gap-4 bg-slate-100/70 p-6 lg:flex">
        <div className="flex items-center justify-between">
          <Bone className="h-5 w-28" />
          <Bone className="h-9 w-24 rounded-lg" />
        </div>
        <Bone className="flex-1 rounded-xl" />
      </div>
    </div>
  </div>
);

/**
 * Mirrors `CreativeSummaryStats`: the three KPI cards, the daily chart and the by-page table. The page
 * shows it while a creative's first counts load; the route skeleton below wraps it with the header.
 */
export const CreativeSummaryStatsSkeleton = () => (
  <div className="space-y-6">
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {Array.from({ length: 3 }, (_, index) => (
        <div key={index} className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
          <Bone className="h-4 w-24" />
          <Bone className="h-7 w-16" />
        </div>
      ))}
    </div>
    <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
      <Bone className="h-4 w-24" />
      <Bone className="h-64 w-full" />
    </div>
    <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex justify-between gap-4">
        <Bone className="h-4 w-20" />
        <Bone className="h-3 w-48" />
      </div>
      {Array.from({ length: 5 }, (_, index) => (
        <div key={index} className="flex items-center gap-4">
          <Bone className="h-4 flex-1" />
          <Bone className="h-4 w-14" />
          <Bone className="h-4 w-10" />
          <Bone className="h-4 w-12" />
        </div>
      ))}
    </div>
  </div>
);

/**
 * Mirrors `CreativeSummary`: the survey summary's header (title, status dropdown and icon bar, then the
 * facts row where a survey has its tabs), the range picker with the freshness note, and the stats.
 */
export const CreativeSummarySkeleton = () => (
  <div className="space-y-6 p-6">
    <div className="border-b border-slate-200">
      <div className="flex items-center justify-between gap-x-4 pb-4">
        <Bone className="h-9 w-56" />
        <div className="flex gap-x-1.5">
          <Bone className="h-9 w-[170px] md:w-[200px]" />
          <Bone className="h-9 w-[74px]" />
        </div>
      </div>
      <div className="flex gap-x-5 pb-4">
        <Bone className="h-5 w-32" />
        <Bone className="h-5 w-44" />
      </div>
    </div>
    <div className="flex items-center justify-between gap-3">
      <Bone className="h-[38px] w-60" />
      <Bone className="h-3 w-48" />
    </div>
    <CreativeSummaryStatsSkeleton />
  </div>
);
