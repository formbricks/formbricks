"use client";

import { Handle, Position } from "@xyflow/react";
import {
  FilterIcon,
  GitBranchIcon,
  GlobeIcon,
  type LucideIcon,
  MailIcon,
  MessageCircleIcon,
  SplitIcon,
  TriangleAlertIcon,
  WebhookIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import {
  type TWorkflowCanvasDirection,
  WORKFLOW_CANVAS_HORIZONTAL,
} from "@/modules/ee/workflows/lib/canvas-geometry";
import type { TWorkflowNodeData, TWorkflowNodeIcon } from "@/modules/ee/workflows/state/editor";
import { FlowTextParts, useElementIcons } from "@/modules/survey/editor/components/reference-chip";
import { Badge } from "@/modules/ui/components/badge";
import { TruncationTooltip } from "@/modules/ui/components/info-tooltip";

export const NODE_ICONS: Record<TWorkflowNodeIcon, LucideIcon> = {
  survey: MessageCircleIcon,
  webhook: WebhookIcon,
  ifElse: GitBranchIcon,
  filter: FilterIcon,
  switch: SplitIcon,
  email: MailIcon,
  http: GlobeIcon,
};

// Shared with the add-trigger / add-action pickers so selector icons carry the same category
// colors as the canvas cards.
export const CATEGORY_CHIP_CLASS_NAMES: Record<TWorkflowNodeData["category"], string> = {
  trigger: "bg-indigo-500 text-white",
  flow: "bg-purple-500 text-white",
  action: "bg-green-600 text-white",
};

/** A step's icon on its category color, as on its canvas card. Also leads the step's panel header. */
export const WorkflowNodeChip = ({
  icon,
  category,
  size = "md",
}: Readonly<{ icon: TWorkflowNodeIcon; category: TWorkflowNodeData["category"]; size?: "sm" | "md" }>) => {
  const Icon = NODE_ICONS[icon];
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex shrink-0 items-center justify-center rounded-md",
        size === "sm" ? "size-6" : "size-8",
        CATEGORY_CHIP_CLASS_NAMES[category]
      )}>
      <Icon className={size === "sm" ? "size-3.5" : "size-4"} strokeWidth={1.75} />
    </span>
  );
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
  /** Left to right, the incoming line arrives on the left and every card is one height. */
  direction?: TWorkflowCanvasDirection;
  /** Part of a pending cut. */
  isCut?: boolean;
}

// The card every step and the trigger share on the canvas: category chip, title, and the summary
// or the issue that replaces it.
export const WorkflowNodeCard = ({
  data,
  selected,
  menu,
  children,
  direction = "vertical",
  isCut = false,
}: Readonly<WorkflowNodeCardProps>) => {
  const isHorizontal = direction === "horizontal";
  const Icon = NODE_ICONS[data.icon];
  const elementIcons = useElementIcons();

  return (
    <div
      // Measured when the card is dragged, to outline its old place (use-step-move).
      data-step-card=""
      className={cn(
        // Issues don't tint the card border — the inline alert line below carries the
        // severity; a second color signal on the frame just adds noise.
        // The hover shadow needs no pan-mode gate: the canvas disables pointer events on
        // nodes in pan mode, so hover styles can't fire there.
        "flex w-64 items-start gap-2.5 rounded-lg border border-slate-200 bg-white px-2.5 py-2.5 shadow-card-sm transition-shadow hover:shadow-card-md",
        selected && "ring-2 ring-brand-dark ring-offset-2 ring-offset-slate-50",
        // Cut and not pasted yet: faded until it moves, or Escape or Undo puts it back.
        isCut && "border-dashed opacity-50",
        // On the Runs view's canvas, the shown run's result for this step sits above the card.
        data.runBadge && "relative"
      )}
      style={isHorizontal ? { height: WORKFLOW_CANVAS_HORIZONTAL.cardHeight } : undefined}>
      <Handle
        type="target"
        position={isHorizontal ? Position.Left : Position.Top}
        className={HANDLE_CLASS_NAMES}
      />
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
          // If/else and Switch read as a sentence with chips, like the survey flow editor's rules. A chip
          // can take the whole line; when the sentence is cut off, hovering shows all of it, as there.
          <TruncationTooltip
            content={data.summary}
            className="line-clamp-2 text-xs leading-[20px] text-slate-500">
            {data.summaryParts ? (
              <FlowTextParts parts={data.summaryParts} elementIcons={elementIcons} />
            ) : (
              data.summary
            )}
          </TruncationTooltip>
        )}
      </div>
      {menu}
      {children}
      {data.runBadge ? (
        <span className="absolute -top-6 right-0">
          <Badge text={data.runBadge.label} type={data.runBadge.type} size="tiny" />
        </span>
      ) : null}
    </div>
  );
};
