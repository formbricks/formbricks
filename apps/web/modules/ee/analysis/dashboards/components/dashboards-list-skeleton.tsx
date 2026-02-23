const SKELETON_ROWS = 3;

const SkeletonRow = () => {
  return (
    <div className="grid h-12 w-full animate-pulse grid-cols-8 content-center">
      <div className="col-span-7 grid grid-cols-7 content-center p-2">
        <div className="col-span-3 flex items-center gap-4 pl-6">
          <div className="h-5 w-5 rounded bg-gray-200" />
          <div className="h-4 w-36 rounded bg-gray-200" />
        </div>
        <div className="col-span-1 my-auto hidden sm:flex sm:justify-center">
          <div className="h-4 w-6 rounded bg-gray-200" />
        </div>
        <div className="col-span-1 my-auto hidden sm:flex sm:justify-center">
          <div className="h-4 w-16 rounded bg-gray-200" />
        </div>
        <div className="col-span-1 my-auto hidden sm:flex sm:justify-center">
          <div className="h-4 w-24 rounded bg-gray-200" />
        </div>
        <div className="col-span-1 my-auto hidden sm:flex sm:justify-center">
          <div className="h-4 w-20 rounded bg-gray-200" />
        </div>
      </div>
      <div className="col-span-1" />
    </div>
  );
};

interface DashboardsListSkeletonProps {
  columnHeaders: string[];
}

export const DashboardsListSkeleton = ({ columnHeaders }: Readonly<DashboardsListSkeletonProps>) => {
  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="grid h-12 grid-cols-8 content-center border-b text-left text-sm font-semibold text-slate-900">
        <div className="col-span-3 pl-6">{columnHeaders[0]}</div>
        <div className="col-span-1 hidden text-center sm:block">{columnHeaders[1]}</div>
        <div className="col-span-1 hidden text-center sm:block">{columnHeaders[2]}</div>
        <div className="col-span-1 hidden text-center sm:block">{columnHeaders[3]}</div>
        <div className="col-span-1 hidden text-center sm:block">{columnHeaders[4]}</div>
        <div className="col-span-1" />
      </div>
      {Array.from({ length: SKELETON_ROWS }).map((_, i) => (
        <SkeletonRow key={`skeleton-row-${String(i)}`} />
      ))}
    </div>
  );
};
