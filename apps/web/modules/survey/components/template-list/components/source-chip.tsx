"use client";

import { PencilIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/modules/ui/components/button";
import { TooltipRenderer } from "@/modules/ui/components/tooltip";

type SourceChipProps = {
  /** The prompt text, or the file name. */
  label: string;
  /** Screen-reader prefix: "Your prompt", "Your file". */
  srLabel: string;
  /** A secondary detail after the label — a file size, for instance. */
  detail?: string;
  icon?: ReactNode;
  editLabel: string;
  onEdit: () => void;
  disabled?: boolean;
  id?: string;
};

/**
 * The source, settled. It is the same content the input held, so it borrows that component's shape —
 * same radius and text size — with a lighter border and a filled ground to say it is no longer the
 * thing you are editing. The pencil lives inside that frame: pinned to the dialog edge instead, it
 * read as an unrelated control floating in whitespace.
 */
export const SourceChip = ({
  label,
  srLabel,
  detail,
  icon,
  editLabel,
  onEdit,
  disabled = false,
  id = "ai-source-echo",
}: Readonly<SourceChipProps>) => (
  <div className="flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 py-1 pr-1 pl-3">
    {icon ? <span className="flex shrink-0 items-center text-slate-500">{icon}</span> : null}
    <p id={id} className="min-w-0 flex-1 truncate text-sm text-slate-700">
      <span className="sr-only">{srLabel}: </span>
      {label}
      {detail ? <span className="ml-1 text-xs text-slate-500">{detail}</span> : null}
    </p>
    <TooltipRenderer tooltipContent={editLabel}>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-7 shrink-0 text-slate-500 hover:text-slate-800"
        disabled={disabled}
        // Icon-only, so it needs its own name; describedby points at the source it acts on.
        aria-label={editLabel}
        aria-describedby={id}
        onClick={onEdit}>
        <PencilIcon aria-hidden="true" />
      </Button>
    </TooltipRenderer>
  </div>
);
