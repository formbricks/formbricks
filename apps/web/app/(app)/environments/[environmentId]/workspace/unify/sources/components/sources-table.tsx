"use client";

import { SourcesTableDataRow } from "./sources-table-data-row";
import { TSourceConnection } from "./types";

interface SourcesTableProps {
  sources: TSourceConnection[];
  onSourceClick: (source: TSourceConnection) => void;
}

export function SourcesTable({ sources, onSourceClick }: SourcesTableProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="grid h-12 grid-cols-12 content-center border-b border-slate-200 text-left text-sm font-semibold text-slate-900">
        <div className="col-span-1 pl-6">Type</div>
        <div className="col-span-6">Name</div>
        <div className="col-span-2 hidden text-center sm:block">Mappings</div>
        <div className="col-span-3 hidden pr-6 text-right sm:block">Created</div>
      </div>
      {sources.length === 0 ? (
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
