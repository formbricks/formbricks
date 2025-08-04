import { cn } from "@/lib/cn";
import { IdBadge } from "@/modules/ui/components/id-badge";

interface RankingResponseProps {
  value: { value: string; id: string | undefined }[];
  isExpanded: boolean;
  showId: boolean;
}

export const RankingResponse = ({ value, isExpanded, showId }: RankingResponseProps) => {
  return (
    <div
      className={cn("text-slate-700", isExpanded ? "space-y-2" : "flex space-x-2", showId ? "flex-col" : "")}
      dir="auto">
      {value.map(
        (item, index) =>
          item.value && (
            <div key={item.value} className="flex items-center space-x-2">
              <span className="text-slate-400">#{index + 1}</span>
              <div className="rounded bg-slate-100 px-2 py-1 font-semibold">{item.value}</div>
              {item.id && showId && <IdBadge id={item.id} />}
            </div>
          )
      )}
    </div>
  );
};
