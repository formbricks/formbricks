import { cn } from "@/lib/cn";
import { IdBadge } from "@/modules/ui/components/id-badge";
import React from "react";

interface ResponseBadgesProps {
  items: { value: string | number; id?: string }[];
  isExpanded?: boolean;
  icon?: React.ReactNode;
  showId: boolean;
}

export const ResponseBadges: React.FC<ResponseBadgesProps> = ({
  items,
  isExpanded = false,
  icon,
  showId,
}) => {
  return (
    <div className={cn("my-1 flex gap-2", isExpanded ? "flex-wrap" : "", showId ? "flex-col" : "")}>
      {items.map((item, index) => (
        <div key={`${item.value}-${index}`} className={cn("flex items-center gap-2")}>
          <span className="flex items-center rounded-md bg-slate-200 px-2 py-1 font-medium">
            {icon && <span className="mr-1.5">{icon}</span>}
            {item.value}
          </span>
          {item.id && showId && <IdBadge id={item.id} />}
        </div>
      ))}
    </div>
  );
};
