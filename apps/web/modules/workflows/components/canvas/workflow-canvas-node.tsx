"use client";

import { Handle, type Node, type NodeProps, Position } from "@xyflow/react";
import { GitBranchIcon, type LucideIcon, MailIcon, MoreVerticalIcon, ZapIcon } from "lucide-react";
import { memo } from "react";
import { cn } from "@/lib/cn";
import { Button } from "@/modules/ui/components/button";
import type { TWorkflowNodeData, TWorkflowNodeIcon } from "@/modules/workflows/state/editor";

const NODE_ICONS: Record<TWorkflowNodeIcon, LucideIcon> = {
  trigger: ZapIcon,
  ifElse: GitBranchIcon,
  email: MailIcon,
};

const CATEGORY_CHIP_CLASS_NAMES: Record<TWorkflowNodeData["category"], string> = {
  trigger: "bg-indigo-500 text-white",
  flow: "bg-purple-500 text-white",
  action: "bg-green-600 text-white",
};

const HANDLE_CLASS_NAMES = "!h-0 !w-0 !min-h-0 !min-w-0 !border-0 !bg-transparent !opacity-0";

export const WorkflowCanvasNode = memo(({ data, selected }: NodeProps<Node<TWorkflowNodeData>>) => {
  const Icon = NODE_ICONS[data.icon];

  return (
    <div
      className={cn(
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
        <span className="truncate text-[13px] font-semibold leading-tight text-slate-900">{data.title}</span>
        <span className="line-clamp-2 text-xs leading-tight text-slate-500">{data.summary}</span>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="Node actions"
        className="size-6"
        onClick={(event) => event.stopPropagation()}>
        <MoreVerticalIcon />
      </Button>
      <Handle type="source" position={Position.Bottom} className={HANDLE_CLASS_NAMES} />
    </div>
  );
});

WorkflowCanvasNode.displayName = "WorkflowCanvasNode";
