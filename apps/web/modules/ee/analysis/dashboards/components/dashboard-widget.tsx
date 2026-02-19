"use client";

import { MoreVerticalIcon, TrashIcon } from "lucide-react";
import { ReactNode, useState } from "react";
import { cn } from "@/lib/cn";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/modules/ui/components/dropdown-menu";

interface DashboardWidgetProps {
  title: string;
  children: ReactNode;
  isEditing?: boolean;
  onRemove?: () => void;
}

export function DashboardWidget({ title, children, isEditing, onRemove }: DashboardWidgetProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div
      className={cn(
        "flex h-full flex-col rounded-sm border border-gray-200 bg-white shadow-sm ring-2 ring-transparent",
        isEditing && "ring-brand-dark/20 transition-shadow hover:ring-brand-dark/40"
      )}
    >
      <div
        className={cn(
          "flex h-10 items-center justify-between border-b border-gray-100 px-4",
          isEditing && "rgl-drag-handle cursor-grab active:cursor-grabbing"
        )}
      >
        <h3 className="flex-1 truncate text-sm font-semibold text-gray-800">{title}</h3>
        {onRemove && (
          <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="ml-2 shrink-0 rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
              >
                <MoreVerticalIcon className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem
                onSelect={() => {
                  setMenuOpen(false);
                  onRemove();
                }}
                className="text-red-600 focus:text-red-600"
              >
                <TrashIcon className="mr-2 h-4 w-4" />
                Remove
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
      <div className="relative flex-1 overflow-hidden p-4">{children}</div>
    </div>
  );
}
