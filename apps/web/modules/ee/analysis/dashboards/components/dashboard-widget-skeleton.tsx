export function DashboardWidgetSkeleton() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3">
      <div className="h-40 w-full animate-pulse rounded bg-gray-100" />
      <div className="flex w-full justify-between">
        <div className="h-3 w-12 animate-pulse rounded bg-gray-100" />
        <div className="h-3 w-12 animate-pulse rounded bg-gray-100" />
        <div className="h-3 w-12 animate-pulse rounded bg-gray-100" />
        <div className="h-3 w-12 animate-pulse rounded bg-gray-100" />
      </div>
    </div>
  );
}
