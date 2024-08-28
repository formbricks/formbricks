import { cn } from "@formbricks/lib/cn";

interface ResponseBadgesProps {
  items: string[] | number[]; // The array of items to display as badges
  isExpanded?: boolean; // Optional prop to determine layout
}

export const ResponseBadges = ({ items, isExpanded = false }: ResponseBadgesProps) => {
  return (
    <div className={cn("my-1 flex gap-2", isExpanded ? "flex-wrap" : "")}>
      {items.map((item, index) => (
        <span key={index} className="rounded-md bg-slate-200 px-2 py-1 font-medium">
          {item}
        </span>
      ))}
    </div>
  );
};
