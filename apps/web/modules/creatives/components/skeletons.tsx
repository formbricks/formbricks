import { cn } from "@/lib/cn";

// Route-level loading states. Each mirrors the real page's grid closely enough that nothing jumps
// when the content arrives: same header height, same column widths, same panel order.

const Bone = ({ className }: Readonly<{ className?: string }>) => (
  <div className={cn("animate-pulse rounded-md bg-slate-200", className)} />
);

const HeaderSkeleton = ({ withActions = true }: Readonly<{ withActions?: boolean }>) => (
  <div className="flex items-center justify-between border-b border-slate-200 pb-4">
    <Bone className="h-9 w-44" />
    {withActions && (
      <div className="flex gap-2">
        <Bone className="h-8 w-24 rounded-full" />
        <Bone className="h-8 w-32" />
      </div>
    )}
  </div>
);

/** Mirrors the workflows/surveys list loading state: toolbar, card-table header and rows. */
export const CreativesListSkeleton = () => (
  <div className="space-y-6 p-6">
    <HeaderSkeleton />
    <div className="flex items-center justify-between gap-4">
      <div className="flex gap-x-2">
        <Bone className="h-8 w-80" />
        <Bone className="h-8 w-24" />
        <Bone className="h-8 w-20" />
      </div>
      <Bone className="h-8 w-40" />
    </div>
    <div className="space-y-3">
      <div className="mt-6 grid w-full grid-cols-8 place-items-center gap-3 px-6 pr-8">
        <Bone className="col-span-2 h-4 w-full" />
        {Array.from({ length: 6 }, (_, index) => (
          <Bone key={index} className="col-span-1 h-4 w-full" />
        ))}
      </div>
      {Array.from({ length: 5 }, (_, index) => (
        <div
          key={index}
          className="grid w-full grid-cols-8 place-items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 pr-8">
          <div className="col-span-2 w-full">
            <Bone className="h-4 w-44" />
          </div>
          <Bone className="col-span-1 h-6 w-20 rounded-full" />
          {Array.from({ length: 5 }, (_, cell) => (
            <Bone key={cell} className="col-span-1 h-4 w-full" />
          ))}
        </div>
      ))}
    </div>
  </div>
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

export const CreativeSummarySkeleton = () => (
  <div className="space-y-6 p-6">
    <HeaderSkeleton />
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {Array.from({ length: 3 }, (_, index) => (
        <div key={index} className="space-y-3 rounded-xl border border-slate-200 bg-white p-5">
          <Bone className="h-3 w-24" />
          <Bone className="h-8 w-28" />
        </div>
      ))}
    </div>
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <Bone className="h-80 rounded-xl" />
      <Bone className="h-80 rounded-xl" />
    </div>
  </div>
);
