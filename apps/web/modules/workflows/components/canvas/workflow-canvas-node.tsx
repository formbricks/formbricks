"use client";

import { Handle, type Node, type NodeProps, Position } from "@xyflow/react";
import { useAtomValue, useSetAtom } from "jotai";
import {
  GitBranchIcon,
  type LucideIcon,
  MailIcon,
  MoreVerticalIcon,
  PlusIcon,
  Trash2Icon,
  ZapIcon,
} from "lucide-react";
import { memo } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { Button } from "@/modules/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/modules/ui/components/dropdown-menu";
import {
  type TWorkflowNodeData,
  type TWorkflowNodeIcon,
  appendSendEmailAfterNodeAtom,
  canMutateCanvasAtom,
  deleteWorkflowNodeAtom,
} from "@/modules/workflows/state/editor";

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

export const WorkflowCanvasNode = memo(
  ({ id, data, selected }: Readonly<NodeProps<Node<TWorkflowNodeData>>>) => {
    const { t } = useTranslation();
    const deleteNode = useSetAtom(deleteWorkflowNodeAtom);
    const appendSendEmail = useSetAtom(appendSendEmailAfterNodeAtom);
    const canMutate = useAtomValue(canMutateCanvasAtom);
    const Icon = NODE_ICONS[data.icon];
    const isTrigger = data.category === "trigger";

    return (
      <div className="flex flex-col items-center">
        <div
          className={cn(
            "flex w-64 items-start gap-2.5 rounded-lg border border-slate-200 bg-white px-2.5 py-2.5 shadow-card-sm transition-shadow hover:shadow-card-md",
            // Same red the survey editor uses for invalid cards — the node can't run as configured.
            data.isInvalid && "border-red-400",
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
            <span className="truncate text-[13px] leading-tight font-semibold text-slate-900">
              {data.title}
            </span>
            <span className="line-clamp-2 text-xs leading-tight text-slate-500">{data.summary}</span>
          </div>
          {!isTrigger && canMutate && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={t("workspace.workflows.node_actions")}
                  className="size-6"
                  onClick={(event) => event.stopPropagation()}>
                  <MoreVerticalIcon />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={(event) => {
                    event.stopPropagation();
                    deleteNode(id);
                  }}>
                  <Trash2Icon className="size-4" />
                  {t("common.delete")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <Handle type="source" position={Position.Bottom} className={HANDLE_CLASS_NAMES} />
        </div>
        {isTrigger && data.isLeaf && canMutate && (
          // Only the trigger gets an inline `+` — workflows are currently capped at one action
          // after the trigger, so neither the trailing send_email card nor mid-chain edges
          // should advertise the affordance.
          <div className="mt-2 flex flex-col items-center gap-1">
            <div className="h-3 w-px bg-slate-300" />
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label={t("workspace.workflows.add_step")}
              className="size-6 rounded-full bg-white shadow-sm"
              onClick={(event) => {
                event.stopPropagation();
                appendSendEmail(id);
              }}>
              <PlusIcon />
            </Button>
          </div>
        )}
      </div>
    );
  }
);

WorkflowCanvasNode.displayName = "WorkflowCanvasNode";
