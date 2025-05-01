export default function TransactionItemSkeleton() {
  const skeletonPulseStyle = "animate-pulse rounded bg-slate-200";

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-slate-200 p-3">
      <div className="flex flex-row items-center gap-3">
        <div className={`h-8 w-8 ${skeletonPulseStyle} rounded-full`}></div>

        <div className="flex flex-1 flex-col gap-1">
          <div className="flex flex-1 flex-row justify-between gap-4">
            <div className={`h-5 w-36 ${skeletonPulseStyle}`}></div>
            <div className={`h-5 w-24 ${skeletonPulseStyle}`}></div>
          </div>

          <div className="flex flex-1 flex-row justify-between gap-4">
            <div className={`h-4 w-20 ${skeletonPulseStyle}`}></div>
            <div className={`h-4 w-32 ${skeletonPulseStyle}`}></div>
          </div>
        </div>
      </div>
    </div>
  );
}
