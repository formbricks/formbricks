"use client";

import { cn } from "@/lib/cn";
import { formatCount } from "../lib/mock-data";
import type { TaxonomyKeyword } from "../types";
import { Button } from "@/modules/ui/components/button";

interface TaxonomyKeywordColumnProps {
  title: string;
  keywords: TaxonomyKeyword[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  addButtonLabel?: string;
  onAdd?: () => void;
}

export function TaxonomyKeywordColumn({
  title,
  keywords,
  selectedId,
  onSelect,
  addButtonLabel,
  onAdd,
}: TaxonomyKeywordColumnProps) {
  return (
    <div className="flex flex-col rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-4 py-3">
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      </div>
      <div className="flex min-h-[320px] flex-1 flex-col overflow-y-auto">
        {keywords.map((kw) => (
          <button
            key={kw.id}
            type="button"
            onClick={() => onSelect(kw.id)}
            className={cn(
              "grid w-full grid-cols-[1fr,auto] content-center gap-3 border-b border-slate-100 px-4 py-3 text-left transition-colors last:border-b-0",
              selectedId === kw.id ? "bg-slate-50" : "hover:bg-slate-50"
            )}>
            <span className="min-w-0 truncate text-sm font-medium text-slate-800">{kw.name}</span>
            <span className="text-sm text-slate-500">{formatCount(kw.count)}</span>
          </button>
        ))}
        {addButtonLabel && (
          <div className="border-t border-slate-200 p-2">
            <Button type="button" variant="outline" size="sm" className="w-full" onClick={onAdd}>
              + {addButtonLabel}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
