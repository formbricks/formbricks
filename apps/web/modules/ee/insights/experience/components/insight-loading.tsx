const LoadingRow = () => (
  <div className="flex items-center justify-between">
    <div className="ph-no-capture h-6 w-10 animate-pulse rounded-full bg-slate-200"></div>
    <div className="ph-no-capture h-6 w-40 animate-pulse rounded-full bg-slate-200"></div>
    <div className="ph-no-capture h-6 w-48 animate-pulse rounded-full bg-slate-200"></div>
    <div className="ph-no-capture h-6 w-16 animate-pulse rounded-full bg-slate-200"></div>
  </div>
);

export const InsightLoading = () => {
  return (
    <div className="space-y-4">
      <div className="ph-no-capture animate-pulse rounded-lg bg-white">
        <div className="space-y-4 p-4">
          <LoadingRow />
          <LoadingRow />
          <LoadingRow />
        </div>
      </div>
    </div>
  );
};
