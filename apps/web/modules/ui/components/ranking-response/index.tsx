import { cn } from "@formbricks/lib/cn";

interface RankingResponseProps {
  value: string[];
  isExpanded: boolean;
}

export const RankingRespone = ({ value, isExpanded }: RankingResponseProps) => {
  return (
    <div className={cn("my-1 font-semibold text-slate-700", isExpanded ? "" : "flex space-x-2")} dir="auto">
      {value.map(
        (item, index) =>
          item && (
            <div key={index} className="mb-1 flex items-center">
              <span className="mr-2 text-slate-400">#{index + 1}</span>
              <div className="rounded-sm bg-slate-100 px-2 py-1">{item}</div>
            </div>
          )
      )}
    </div>
  );
};
