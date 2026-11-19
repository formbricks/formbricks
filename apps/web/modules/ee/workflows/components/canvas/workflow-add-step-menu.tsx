"use client";

import { useAtomValue } from "jotai";
import {
  ClipboardPasteIcon,
  FilterIcon,
  GitBranchIcon,
  GlobeIcon,
  type LucideIcon,
  MailIcon,
  PlusIcon,
  SplitIcon,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { WORKFLOW_LIMITS } from "@formbricks/workflows";
import { cn } from "@/lib/cn";
import { trackWorkflowEvent } from "@/modules/ee/workflows/lib/analytics";
import { WORKFLOW_CLIENT_EVENTS } from "@/modules/ee/workflows/lib/analytics-events";
import type { TPasteTarget } from "@/modules/ee/workflows/lib/step-clipboard";
import { getMoveTargetKey } from "@/modules/ee/workflows/lib/step-move";
import type { TAddableWorkflowStepType } from "@/modules/ee/workflows/lib/workflow-steps";
import {
  type TStepMoveDrag,
  type TWorkflowNodeCategory,
  canAddWorkflowStepAtom,
  stepMoveDragAtom,
} from "@/modules/ee/workflows/state/editor";
import { Button } from "@/modules/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/modules/ui/components/dropdown-menu";
import { TooltipRenderer } from "@/modules/ui/components/tooltip";
import { CATEGORY_CHIP_CLASS_NAMES } from "./workflow-node-card";

interface WorkflowAddStepMenuProps {
  /** Concrete type of the step the new one follows, for analytics. */
  afterNodeType: string;
  ariaLabel: string;
  onAdd: (stepType: TAddableWorkflowStepType) => void;
  /** Told when the step picker opens or closes, e.g. to keep a hover-only `+` visible meanwhile. */
  onOpenChange?: (open: boolean) => void;
  /** Set while something cut or copied can go here: the picker then offers "Paste here" first. */
  onPaste?: () => void;
  /** Where this `+` puts a step, so a dragged step card can be dropped on it. */
  moveTarget?: TPasteTarget;
}

interface TStepOption {
  stepType: TAddableWorkflowStepType;
  category: TWorkflowNodeCategory;
  icon: LucideIcon;
  label: string;
  description: string;
}

interface WorkflowStepPickerItemsProps {
  afterNodeType: string;
  onAdd: (stepType: TAddableWorkflowStepType) => void;
  onPaste?: () => void;
}

/**
 * The step picker's items: "Paste here" while something cut or copied can go there, then the steps
 * grouped as Logic and Actions. Shared by the `+` buttons and a step's "Insert a step after" submenu.
 */
export const WorkflowStepPickerItems = ({
  afterNodeType,
  onAdd,
  onPaste,
}: Readonly<WorkflowStepPickerItemsProps>) => {
  const { t } = useTranslation();
  const canAddStep = useAtomValue(canAddWorkflowStepAtom);

  const logic: TStepOption[] = [
    {
      stepType: "if_else",
      category: "flow",
      icon: GitBranchIcon,
      label: t("workspace.workflows.if_else"),
      description: t("workspace.workflows.if_else_description"),
    },
    {
      stepType: "filter",
      category: "flow",
      icon: FilterIcon,
      label: t("workspace.workflows.filter"),
      description: t("workspace.workflows.filter_description"),
    },
    {
      stepType: "switch",
      category: "flow",
      icon: SplitIcon,
      label: t("workspace.workflows.switch"),
      description: t("workspace.workflows.switch_description"),
    },
  ];
  const actions: TStepOption[] = [
    {
      stepType: "send_email",
      category: "action",
      icon: MailIcon,
      label: t("workspace.workflows.send_email"),
      description: t("workspace.workflows.send_email_description"),
    },
    {
      stepType: "http_request",
      category: "action",
      icon: GlobeIcon,
      label: t("workspace.workflows.http_request"),
      description: t("workspace.workflows.http_request_description"),
    },
  ];

  const renderOption = (option: TStepOption) => (
    <DropdownMenuItem
      key={option.stepType}
      disabled={!canAddStep}
      onClick={(event) => {
        event.stopPropagation();
        trackWorkflowEvent(WORKFLOW_CLIENT_EVENTS.actionAdded, {
          action_type: option.stepType,
          after_node_type: afterNodeType,
        });
        onAdd(option.stepType);
      }}>
      <span
        className={cn(
          "flex size-6 shrink-0 items-center justify-center rounded-md",
          CATEGORY_CHIP_CLASS_NAMES[option.category]
        )}>
        <option.icon className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="text-sm text-slate-700">{option.label}</span>
        <span className="text-xs text-slate-500">{option.description}</span>
      </span>
    </DropdownMenuItem>
  );

  return (
    <>
      {onPaste ? (
        <>
          <DropdownMenuItem
            onClick={(event) => {
              event.stopPropagation();
              onPaste();
            }}>
            <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-600">
              <ClipboardPasteIcon className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
            </span>
            <span className="text-sm text-slate-700">{t("workspace.workflows.paste_here")}</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
        </>
      ) : null}
      <DropdownMenuLabel>{t("workspace.workflows.logic")}</DropdownMenuLabel>
      {logic.map(renderOption)}
      <DropdownMenuSeparator />
      <DropdownMenuLabel>{t("common.actions")}</DropdownMenuLabel>
      {actions.map(renderOption)}
    </>
  );
};

// The round `+` at the end of the workflow or of an If/else or Switch branch. It opens a step picker grouped as
// Logic and Actions (ENG-7121), so the user consciously chooses each step. At the step limit the `+`
// stays visible but disabled, with the reason on hover.
export const WorkflowAddStepMenu = ({
  afterNodeType,
  ariaLabel,
  onAdd,
  onOpenChange,
  onPaste,
  moveTarget,
}: Readonly<WorkflowAddStepMenuProps>) => {
  const { t } = useTranslation();
  const canAddStep = useAtomValue(canAddWorkflowStepAtom);
  const moveDrag = useAtomValue(stepMoveDragAtom);

  if (moveDrag) return <StepMoveDropTarget drag={moveDrag} target={moveTarget} />;

  const trigger = (
    <Button
      type="button"
      variant="outline"
      size="icon"
      aria-label={ariaLabel}
      // A move adds no step, so a pending paste keeps the `+` usable at the step limit.
      disabled={!canAddStep && !onPaste}
      className="size-6 rounded-full bg-white shadow-sm"
      onClick={(event) => event.stopPropagation()}>
      <PlusIcon />
    </Button>
  );

  if (!canAddStep && !onPaste) {
    return (
      // A disabled button gets no pointer events; the renderer's wrapping span carries the tooltip.
      <TooltipRenderer
        triggerClass="inline-flex"
        tooltipContent={t("workspace.workflows.step_limit_reached", { count: WORKFLOW_LIMITS.maxSteps })}>
        {trigger}
      </TooltipRenderer>
    );
  }

  return (
    <DropdownMenu onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent align="center" className="w-64 motion-reduce:animate-none">
        <WorkflowStepPickerItems afterNodeType={afterNodeType} onAdd={onAdd} onPaste={onPaste} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

/**
 * A `+` while a step card is dragged: lit where the step can go, the nearest one grown with "Move
 * here", hidden elsewhere (keeping its room, so nothing shifts). Pointer only: the keyboard moves a step
 * from its ⋮ menu ("Move to…").
 */
const StepMoveDropTarget = ({ drag, target }: Readonly<{ drag: TStepMoveDrag; target?: TPasteTarget }>) => {
  const { t } = useTranslation();
  const key = target ? getMoveTargetKey(target) : null;
  if (!key || !drag.targetKeys.has(key)) return <span aria-hidden="true" className="block size-6" />;
  const isHot = drag.hotTargetKey === key;
  return (
    <span
      aria-hidden="true"
      data-step-move-target={key}
      className="relative flex size-6 items-center justify-center">
      <span
        className={cn(
          "flex size-6 items-center justify-center rounded-full border-2 border-brand-dark transition-transform motion-reduce:transition-none",
          isHot
            ? "scale-125 bg-brand-dark text-white ring-4 ring-brand-dark/20"
            : "bg-teal-50 text-brand-dark"
        )}>
        <PlusIcon className="size-3.5" strokeWidth={2.25} />
      </span>
      {isHot ? (
        <span className="absolute left-full ml-3 rounded-full bg-brand-dark px-2 py-0.5 text-xs font-medium whitespace-nowrap text-white shadow-sm">
          {t("workspace.workflows.move_here")}
        </span>
      ) : null}
    </span>
  );
};
