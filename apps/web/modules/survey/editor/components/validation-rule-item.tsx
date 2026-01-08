"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVerticalIcon } from "lucide-react";

interface ValidationRuleItemProps {
  id: string;
  children: React.ReactNode;
}

export const ValidationRuleItem = ({ id, children }: ValidationRuleItemProps) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 1,
    position: isDragging ? "relative" : "static",
  } as React.CSSProperties;

  return (
    <div ref={setNodeRef} style={style} className="flex w-full items-center gap-2">
      <div {...attributes} {...listeners} className="cursor-move text-slate-400 hover:text-slate-600">
        <GripVerticalIcon className="h-4 w-4" />
      </div>
      {children}
    </div>
  );
};
