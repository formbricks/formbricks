"use client";

import { Handle, Position } from "@xyflow/react";
import { GitBranchIcon, type LucideIcon, MailIcon, TriangleAlertIcon, ZapIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import type { TWorkflowNodeData, TWorkflowNodeIcon } from "@/modules/ee/workflows/state/editor";

const NODE_ICONS: Record<TWorkflowNodeIcon, LucideIcon> = {
  trigger: ZapIcon,
  ifElse: GitBranchIcon,
  email: MailIcon,
};

// Shared with the add-trigger / add-action pickers so selector icons carry the same category
// colors as the canvas cards.
export const CATEGORY_CHIP_CLASS_NAMES: Record<TWorkflowNodeData["category"], string> = {
  trigger: "bg-indigo-500 text-white",
  flow: "bg-purple-500 text-white",
  action: "bg-green-600 text-white",
};

// Handles stay invisible: connections are made by the editor, never dragged by hand.
export const HANDLE_CLASS_NAMES = "!h-0 !w-0 !min-h-0 !min-w-0 !border-0 !bg-transparent !opacity-0";

interface WorkflowNodeCardProps {
  data: TWorkflowNodeData;
  selected: boolean;
  /** Trailing control, such as the step's actions menu. */
  menu?: ReactNode;
  /** Rendered last inside the card, such as its outgoing handle. */
  children?: ReactNode;
}

// The card every step and the trigger share on the canvas: category chip, title, and the summary
// or the issue that replaces it.
export const WorkflowNodeCard = ({ data, selected, menu, children }: Readonly<WorkflowNodeCardProps>) => {
  const Icon = NODE_ICONS[data.icon];

  return (
    <div
      className={cn(
        // Issues don't tint the card border — the inline alert line below carries the
        // severity; a second color signal on the frame just adds noise.
        // The hover shadow needs no pan-mode gate: the canvas disables pointer events on
        // nodes in pan mode, so hover styles can't fire there.
        "flex w-64 items-start gap-2.5 rounded-lg border border-slate-200 bg-white px-2.5 py-2.5 shadow-card-sm transition-shadow hover:shadow-card-md",
        selected && "ring-2 ring-brand-dark ring-offset-2 ring-offset-slate-50"
      )}>
      <Handle type="target" position={Position.Top} className={HANDLE_CLASS_NAMES} />
      <span
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-md",
          CATEGORY_CHIP_CLASS_NAMES[data.category]
        )}>
        <Icon className="size-4" strokeWidth={1.75} />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-[13px] leading-tight font-semibold text-slate-900">{data.title}</span>
        {data.issue ? (
          // The reason travels with the highlight — replaces the summary so the user never
          // has to guess why a card is flagged.
          <span
            className={cn(
              "flex items-center gap-1 text-xs leading-tight",
              data.issue.severity === "error" ? "text-red-600" : "text-amber-700"
            )}>
            <TriangleAlertIcon className="size-3 shrink-0" aria-hidden="true" />
            <span className="line-clamp-2">{data.issue.label}</span>
          </span>
        ) : (
          <span className="line-clamp-2 text-xs leading-tight text-slate-500">{data.summary}</span>
        )}
      </div>
      {menu}
      {children}
    </div>
  );
};
