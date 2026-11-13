"use client";

import { useAtomValue } from "jotai";
import { GitBranchIcon, GlobeIcon, type LucideIcon, MailIcon, PlusIcon, SplitIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { WORKFLOW_LIMITS } from "@formbricks/workflows";
import { cn } from "@/lib/cn";
import { trackWorkflowEvent } from "@/modules/ee/workflows/lib/analytics";
import { WORKFLOW_CLIENT_EVENTS } from "@/modules/ee/workflows/lib/analytics-events";
import type { TAddableWorkflowStepType } from "@/modules/ee/workflows/lib/workflow-steps";
import { type TWorkflowNodeCategory, canAddWorkflowStepAtom } from "@/modules/ee/workflows/state/editor";
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
}

interface TStepOption {
  stepType: TAddableWorkflowStepType;
  category: TWorkflowNodeCategory;
  icon: LucideIcon;
  label: string;
  description: string;
}

// The round `+` at the end of the workflow or of an If/else or Switch branch. It opens a step picker grouped as
// Logic and Actions (ENG-7121), so the user consciously chooses each step. At the step limit the `+`
// stays visible but disabled, with the reason on hover.
export const WorkflowAddStepMenu = ({
  afterNodeType,
  ariaLabel,
  onAdd,
}: Readonly<WorkflowAddStepMenuProps>) => {
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

  const trigger = (
    <Button
      type="button"
      variant="outline"
      size="icon"
      aria-label={ariaLabel}
      disabled={!canAddStep}
      className="size-6 rounded-full bg-white shadow-sm"
      onClick={(event) => event.stopPropagation()}>
      <PlusIcon />
    </Button>
  );

  if (!canAddStep) {
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
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent align="center" className="w-64 motion-reduce:animate-none">
        <DropdownMenuLabel>{t("workspace.workflows.logic")}</DropdownMenuLabel>
        {logic.map(renderOption)}
        <DropdownMenuSeparator />
        <DropdownMenuLabel>{t("common.actions")}</DropdownMenuLabel>
        {actions.map(renderOption)}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
