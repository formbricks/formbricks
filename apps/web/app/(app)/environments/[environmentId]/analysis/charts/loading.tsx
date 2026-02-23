import { ChartsListSkeleton } from "@/modules/ee/analysis/charts/components/charts-list-skeleton";

export default function ChartsLoading() {
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <div className="h-9 w-20 animate-pulse rounded-md bg-gray-200" />
      </div>
      <ChartsListSkeleton />
    </div>
  );
}
