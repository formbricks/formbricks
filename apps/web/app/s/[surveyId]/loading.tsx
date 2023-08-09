export default function Loading() {
  return (
    <div className="flex w-1/4 h-1/2 flex-col">
      <div className="ph-no-capture h-16 w-1/3 animate-pulse rounded-lg bg-gray-200 font-medium text-slate-900"></div>
      <div className="ph-no-capture mt-4 h-full animate-pulse rounded-lg bg-gray-200 text-slate-900"></div>
  </div>
  );
}
