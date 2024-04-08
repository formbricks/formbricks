export default function Loading() {
  return (
    <div className="flex h-full w-full items-center justify-center">
      <div className="flex h-1/2 w-3/4 flex-col sm:w-1/2 lg:w-1/4">
        <div className="ph-no-capture h-16 w-1/3 animate-pulse rounded-lg bg-slate-200 font-medium text-slate-900"></div>
        <div className="ph-no-capture mt-4 h-full animate-pulse rounded-lg bg-slate-200 text-slate-900"></div>
      </div>
    </div>
  );
}
