"use client";

import { format, formatDistanceToNow } from "date-fns";
import { FileTextIcon, LinkIcon, MoreHorizontalIcon, StickyNoteIcon, TrashIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/modules/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/modules/ui/components/dropdown-menu";
import { type KnowledgeItem, formatFileSize } from "../types";

interface KnowledgeTableProps {
  items: KnowledgeItem[];
  onDeleteItem?: (itemId: string) => void;
}

function getTypeIcon(type: KnowledgeItem["type"]) {
  switch (type) {
    case "link":
      return <LinkIcon className="size-4 text-slate-500" />;
    case "file":
      return <FileTextIcon className="size-4 text-slate-500" />;
    case "note":
      return <StickyNoteIcon className="size-4 text-slate-500" />;
    default:
      return <FileTextIcon className="size-4 text-slate-500" />;
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

export function KnowledgeTable({ items, onDeleteItem }: KnowledgeTableProps) {
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="grid h-12 grid-cols-12 content-center border-b border-slate-200 text-left text-sm font-semibold text-slate-900">
        <div className="col-span-5 pl-6">Name</div>
        <div className="col-span-2 hidden text-center sm:block">Type</div>
        <div className="col-span-2 hidden text-center sm:block">Size</div>
        <div className="col-span-2 hidden text-center sm:block">Indexed At</div>
        <div className="col-span-1 pr-6 text-right">Actions</div>
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
              {/* Name */}
              <div className="col-span-5 flex items-center gap-3 pl-6">
                {getTypeIcon(item.type)}
                <div className="flex flex-col overflow-hidden">
                  <div className="truncate text-sm font-medium text-slate-900">{getTitleOrPreview(item)}</div>
                  {item.type === "link" && item.url && item.title && (
                    <div className="truncate text-xs text-slate-500">{item.url}</div>
                  )}
                </div>
              </div>

              {/* Type */}
              <div className="col-span-2 hidden items-center justify-center text-sm text-slate-600 sm:flex">
                {getTypeLabel(item.type)}
              </div>

              {/* Size */}
              <div className="col-span-2 hidden items-center justify-center text-sm text-slate-500 sm:flex">
                {formatFileSize(item.size)}
              </div>

              {/* Indexed At */}
              <div className="col-span-2 hidden items-center justify-center text-sm text-slate-500 sm:flex">
                {item.indexedAt ? (
                  <span title={format(item.indexedAt, "PPpp")}>
                    {formatDistanceToNow(item.indexedAt, { addSuffix: true }).replace("about ", "")}
                  </span>
                ) : (
                  <span className="text-slate-400">Pending</span>
                )}
              </div>

              {/* Actions */}
              <div className="col-span-1 flex items-center justify-end pr-6">
                <DropdownMenu
                  open={openMenuId === item.id}
                  onOpenChange={(open) => setOpenMenuId(open ? item.id : null)}>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreHorizontalIcon className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      className="text-red-600 focus:bg-red-50 focus:text-red-700"
                      onClick={() => {
                        onDeleteItem?.(item.id);
                        setOpenMenuId(null);
                      }}>
                      <TrashIcon className="mr-2 h-4 w-4" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
