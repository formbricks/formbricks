"use client";

import { type LucideIcon, PlusIcon, ZapIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { type TWorkflowTriggerType, WORKFLOW_TRIGGERS } from "@formbricks/workflows";
import { cn } from "@/lib/cn";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/modules/ui/components/dropdown-menu";
import { CATEGORY_CHIP_CLASS_NAMES } from "./workflow-canvas-node";

interface WorkflowAddTriggerPickerProps {
  onSelect: (triggerType: TWorkflowTriggerType) => void;
}

interface TriggerOption {
  triggerType: TWorkflowTriggerType;
  icon: LucideIcon;
  label: string;
  description: string;
}

// The empty-canvas starting point: a card styled like the canvas nodes whose click opens a
// popover listing the available triggers. New drafts have no nodes, so this is the only
// affordance on the canvas until a trigger is chosen.
export const WorkflowAddTriggerPicker = ({ onSelect }: Readonly<WorkflowAddTriggerPickerProps>) => {
  const { t } = useTranslation();

  const options: TriggerOption[] = [
    {
      triggerType: WORKFLOW_TRIGGERS.RESPONSE_COMPLETED,
      icon: ZapIcon,
      label: t("workspace.workflows.response_completed"),
      description: t("workspace.workflows.response_completed_description"),
    },
  ];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex w-64 cursor-pointer items-start gap-2.5 rounded-lg border border-slate-200 bg-white px-2.5 py-2.5 text-left shadow-card-sm transition-shadow hover:shadow-card-md">
          <span
            className={cn(
              "flex size-8 shrink-0 items-center justify-center rounded-md",
              CATEGORY_CHIP_CLASS_NAMES.trigger
            )}>
            <PlusIcon className="size-4" strokeWidth={1.75} aria-hidden="true" />
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-[13px] leading-tight font-semibold text-slate-900">
              {t("workspace.workflows.add_trigger")}
            </span>
            <span className="text-xs leading-tight text-slate-500">
              {t("workspace.workflows.add_trigger_description")}
            </span>
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64 motion-reduce:animate-none">
        <DropdownMenuLabel>{t("workspace.workflows.triggers")}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {options.map((option) => (
          <DropdownMenuItem key={option.triggerType} onClick={() => onSelect(option.triggerType)}>
            <span
              className={cn(
                "flex size-6 shrink-0 items-center justify-center rounded-md",
                CATEGORY_CHIP_CLASS_NAMES.trigger
              )}>
              <option.icon className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
            </span>
            <span className="flex min-w-0 flex-col">
              <span className="text-sm text-slate-700">{option.label}</span>
              <span className="text-xs text-slate-500">{option.description}</span>
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
