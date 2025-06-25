import { cn } from "@/lib/cn";
import React from "react";

interface ResponseBadgesProps {
  items: string[] | number[];
  isExpanded?: boolean;
  icon?: React.ReactNode;
}

export const ResponseBadges: React.FC<ResponseBadgesProps> = ({ items, isExpanded = false, icon }) => {
  return (
    <div className={cn("my-1 flex gap-2", isExpanded ? "flex-wrap" : "")}>
      {items.map((item, index) => (
        <span key={index} className="flex items-center rounded-md bg-slate-200 px-2 py-1 font-medium">
          {icon && <span className="mr-1.5">{icon}</span>}
          {item}
        </span>
      ))}
    </div>
  );
};
