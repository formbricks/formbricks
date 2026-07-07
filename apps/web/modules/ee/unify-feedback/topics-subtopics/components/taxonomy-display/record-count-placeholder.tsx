import { cn } from "@/lib/cn";

/**
 * Placeholder for a node's total record count. The Hub has no per-node total today
 * (`nodes.listRecords` returns a capped sample with no total, and `feedbackRecords.list` can't be
 * scoped to a node/cluster), so we render "XXX" until that endpoint lands. This is the single seam
 * to swap for the real count — see the Hub follow-ups in the PR description.
 */
export const RecordCountPlaceholder = ({ className }: Readonly<{ className?: string }>) => (
  <span
    aria-hidden="true"
    className={cn(
      "shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-400",
      className
    )}>
    XXX
  </span>
);
