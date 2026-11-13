"use client";

import { AlertCircleIcon } from "lucide-react";
import { cn } from "@/lib/cn";

export interface TErrorSummaryItem {
  readonly key: string;
  /** What to do, e.g. "Enter an option" (with "×3" when the same thing is wrong in several places). */
  readonly label: string;
  /** Entries are grouped by this, e.g. the editor tab they belong to. */
  readonly group?: string;
  /** Where it is, e.g. "Block 1, Question 2"; entries are grouped under it. */
  readonly location?: string | null;
  /** What sits there, e.g. the question's own text; shown next to the location, muted. */
  readonly locationDetail?: string | null;
  readonly onSelect: () => void;
}

export const ERROR_LINK_CLASS =
  "text-start text-sm text-error-foreground underline underline-offset-2 hover:no-underline focus-visible:rounded-xs focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:outline-hidden";

// Groups entries by tab, then by where they are, keeping the order they arrive in.
const groupItems = (items: readonly TErrorSummaryItem[]) => {
  const groups = new Map<string, Map<string, TErrorSummaryItem[]>>();
  for (const item of items) {
    const locations = groups.get(item.group ?? "") ?? new Map<string, TErrorSummaryItem[]>();
    const location = item.location ?? "";
    locations.set(location, [...(locations.get(location) ?? []), item]);
    groups.set(item.group ?? "", locations);
  }
  return groups;
};

interface ErrorListProps {
  readonly items: readonly TErrorSummaryItem[];
  readonly className?: string;
}

/**
 * Every problem as a link to its place: one card per tab, then one block per question inside it, each problem
 * on its own line with an icon so it never relies on colour alone. The same list the bar's first entry comes
 * from; it has room here to say where each one is.
 */
export const ErrorList = ({ items, className }: ErrorListProps) => (
  <div className={cn("flex flex-col gap-3", className)}>
    {[...groupItems(items)].map(([group, locations]) => (
      <section key={group} className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        {group ? (
          <h3 className="border-b border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-900">
            {group}{" "}
            <span className="ms-1 font-normal text-slate-500">{[...locations.values()].flat().length}</span>
          </h3>
        ) : null}
        <div className="divide-y divide-slate-100">
          {[...locations].map(([location, locationItems]) => (
            <div key={location} className="px-4 py-2">
              {location ? (
                <h4 className="mb-0.5 flex min-w-0 items-baseline gap-1.5 text-sm">
                  <span className="shrink-0 font-semibold text-slate-900">{location}</span>
                  {locationItems[0].locationDetail ? (
                    <span className="truncate font-normal text-slate-500">
                      {locationItems[0].locationDetail}
                    </span>
                  ) : null}
                </h4>
              ) : null}
              <ul className="flex flex-col items-start gap-0.5">
                {locationItems.map((item) => (
                  <li key={item.key} className="flex items-start gap-1.5">
                    <AlertCircleIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-error" />
                    <button type="button" className={ERROR_LINK_CLASS} onClick={item.onSelect}>
                      {item.label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>
    ))}
  </div>
);
