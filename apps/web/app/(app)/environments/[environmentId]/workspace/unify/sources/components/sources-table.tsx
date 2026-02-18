"use client";

import { Loader2Icon } from "lucide-react";
import { TSourceConnection } from "../types";
import { SourcesTableDataRow } from "./sources-table-data-row";

interface SourcesTableProps {
  sources: TSourceConnection[];
  onSourceClick: (source: TSourceConnection) => void;
  isLoading?: boolean;
}

export function SourcesTable({ sources, onSourceClick, isLoading = false }: SourcesTableProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="grid h-12 grid-cols-12 content-center border-b border-slate-200 text-left text-sm font-semibold text-slate-900">
        <div className="col-span-2 pl-6">Type</div>
        <div className="col-span-5">Name</div>
        <div className="col-span-2 hidden text-center sm:block">Mappings</div>
        <div className="col-span-3 hidden pr-6 text-right sm:block">Created</div>
      </div>
      {isLoading ? (
        <div className="flex h-32 items-center justify-center">
          <Loader2Icon className="h-6 w-6 animate-spin text-slate-500" />
        </div>
      ) : sources.length === 0 ? (
        <div className="flex h-32 items-center justify-center">
          <p className="text-sm text-slate-500">No sources connected yet. Add a source to get started.</p>
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {sources.map((source) => (
            <SourcesTableDataRow
              key={source.id}
              id={source.id}
              name={source.name}
              type={source.type}
              mappingsCount={source.mappings.length}
              createdAt={source.createdAt}
              onClick={() => onSourceClick(source)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
