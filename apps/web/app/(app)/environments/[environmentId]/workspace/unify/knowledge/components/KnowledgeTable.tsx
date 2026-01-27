"use client";

import { format, formatDistanceToNow } from "date-fns";
import { FileTextIcon, LinkIcon, StickyNoteIcon } from "lucide-react";
import type { KnowledgeItem } from "../types";

interface KnowledgeTableProps {
  items: KnowledgeItem[];
}

function getTypeIcon(type: KnowledgeItem["type"]) {
  switch (type) {
    case "link":
      return <LinkIcon className="size-5 text-slate-500" />;
    case "file":
      return <FileTextIcon className="size-5 text-slate-500" />;
    case "note":
      return <StickyNoteIcon className="size-5 text-slate-500" />;
    default:
      return <FileTextIcon className="size-5 text-slate-500" />;
  }
}

function getTypeLabel(type: KnowledgeItem["type"]) {
  switch (type) {
    case "link":
      return "Link";
    case "file":
      return "Document";
    case "note":
      return "Note";
    default:
      return type;
  }
}

function getTitleOrPreview(item: KnowledgeItem): string {
  if (item.title) return item.title;
  if (item.type === "link" && item.url) return item.url;
  if (item.type === "file" && item.fileName) return item.fileName;
  if (item.type === "note" && item.content) {
    return item.content.length > 60 ? `${item.content.slice(0, 60)}…` : item.content;
  }
  return "—";
}

export function KnowledgeTable({ items }: KnowledgeTableProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="grid h-12 grid-cols-12 content-center border-b border-slate-200 text-left text-sm font-semibold text-slate-900">
        <div className="col-span-1 pl-6">Type</div>
        <div className="col-span-8">Title / Content</div>
        <div className="col-span-3 hidden pr-6 text-right sm:block">Created</div>
      </div>
      {items.length === 0 ? (
        <p className="py-12 text-center text-sm text-slate-400">
          No knowledge yet. Add a link, upload a document, or add a note.
        </p>
      ) : (
        <div className="divide-y divide-slate-100">
          {items.map((item) => (
            <div
              key={item.id}
              className="grid h-12 min-h-12 grid-cols-12 content-center p-2 text-left transition-colors ease-in-out hover:bg-slate-50">
              <div className="col-span-1 flex items-center pl-6">
                <span className="flex items-center gap-2 text-sm text-slate-600">
                  {getTypeIcon(item.type)}
                  <span className="hidden sm:inline">{getTypeLabel(item.type)}</span>
                </span>
              </div>
              <div className="col-span-8 flex flex-col justify-center">
                <div className="truncate font-medium text-slate-900">{getTitleOrPreview(item)}</div>
                {item.type === "link" && item.url && item.title && (
                  <div className="truncate text-xs text-slate-500">{item.url}</div>
                )}
              </div>
              <div className="col-span-3 flex items-center justify-end pr-6 text-right text-sm text-slate-500">
                {formatDistanceToNow(item.createdAt, { addSuffix: true }).replace("about ", "")}
                <span className="ml-1 hidden sm:inline">
                  ({format(item.createdAt, "MMM d, yyyy")})
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
