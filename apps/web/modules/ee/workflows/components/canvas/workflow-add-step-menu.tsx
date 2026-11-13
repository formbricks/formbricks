"use client";

import { MailIcon, PlusIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { WORKFLOW_ACTIONS } from "@formbricks/workflows";
import { cn } from "@/lib/cn";
import { trackWorkflowEvent } from "@/modules/ee/workflows/lib/analytics";
import { WORKFLOW_CLIENT_EVENTS } from "@/modules/ee/workflows/lib/analytics-events";
import { Button } from "@/modules/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/modules/ui/components/dropdown-menu";
import { CATEGORY_CHIP_CLASS_NAMES } from "./workflow-node-card";

interface WorkflowAddStepMenuProps {
  /** Concrete type of the step the new one follows, for analytics. */
  afterNodeType: string;
  ariaLabel: string;
  onAddSendEmail: () => void;
}

// The round `+` under a step or at the end of an If/else branch. It opens an action picker instead
// of appending a default step, so the user consciously chooses each step.
export const WorkflowAddStepMenu = ({
  afterNodeType,
  ariaLabel,
  onAddSendEmail,
}: Readonly<WorkflowAddStepMenuProps>) => {
  const { t } = useTranslation();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label={ariaLabel}
          className="size-6 rounded-full bg-white shadow-sm"
          onClick={(event) => event.stopPropagation()}>
          <PlusIcon />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="center" className="w-64 motion-reduce:animate-none">
        <DropdownMenuLabel>{t("common.actions")}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={(event) => {
            event.stopPropagation();
            trackWorkflowEvent(WORKFLOW_CLIENT_EVENTS.actionAdded, {
              action_type: WORKFLOW_ACTIONS.SEND_EMAIL,
              after_node_type: afterNodeType,
            });
            onAddSendEmail();
          }}>
          <span
            className={cn(
              "flex size-6 shrink-0 items-center justify-center rounded-md",
              CATEGORY_CHIP_CLASS_NAMES.action
            )}>
            <MailIcon className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="text-sm text-slate-700">{t("workspace.workflows.send_email")}</span>
            <span className="text-xs text-slate-500">{t("workspace.workflows.send_email_description")}</span>
          </span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
