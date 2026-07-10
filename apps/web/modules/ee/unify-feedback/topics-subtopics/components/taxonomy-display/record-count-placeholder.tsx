import { cn } from "@/lib/cn";

/**
 * A taxonomy node's feedback-record count — the node's subtree total from the Hub record-counts
 * endpoint. While counts are still loading (or unavailable for a node) `count` is undefined and a
 * muted skeleton dash renders instead, keeping row widths stable.
 */
export const RecordCountPlaceholder = ({
  count,
  className,
}: Readonly<{ count?: number; className?: string }>) => {
  const hasCount = typeof count === "number";
  return (
    <span
      aria-hidden={hasCount ? undefined : true}
      className={cn(
        "shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-xs font-medium tabular-nums",
        hasCount ? "text-slate-500" : "animate-pulse text-slate-300",
        className
      )}>
      {hasCount ? count.toLocaleString() : "—"}
    </span>
  );
};
