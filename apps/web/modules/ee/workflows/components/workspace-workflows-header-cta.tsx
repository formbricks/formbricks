"use client";

import { ChevronDownIcon, MessageCircleIcon, WebhookIcon } from "lucide-react";
import { useRouter, useSelectedLayoutSegment } from "next/navigation";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { type TWorkflowTriggerType, WORKFLOW_TRIGGERS, ZCreateWorkflowInput } from "@formbricks/workflows";
import { getV3ApiErrorMessage } from "@/modules/api/lib/v3-client";
import { Button } from "@/modules/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/modules/ui/components/dropdown-menu";
import { useCreateWorkflow } from "../hooks/use-create-workflow";
import { createWorkflowDefinitionWithTrigger } from "../lib/default-workflow";

interface WorkspaceWorkflowsHeaderCtaProps {
  workspaceId: string;
  isReadOnly: boolean;
}

export const WorkspaceWorkflowsHeaderCta = ({
  workspaceId,
  isReadOnly,
}: Readonly<WorkspaceWorkflowsHeaderCtaProps>) => {
  const { t } = useTranslation();
  const router = useRouter();
  const segment = useSelectedLayoutSegment();
  const createWorkflowMutation = useCreateWorkflow();

  if (segment !== null || isReadOnly) {
    return null;
  }

  // No dialog: pick the trigger, create the draft at once with a default name and that trigger,
  // then land in the editor with the title focused for renaming (?new=1) and the trigger's panel open.
  const handleCreate = (triggerType: TWorkflowTriggerType) => {
    if (createWorkflowMutation.isPending) return;

    const definition = createWorkflowDefinitionWithTrigger(triggerType);
    const parsed = ZCreateWorkflowInput.safeParse({
      workspaceId,
      name: t("common.new_workflow"),
      description: null,
      status: "draft",
      definition,
    });

    if (!parsed.success) {
      toast.error(t("workspace.workflows.create_failed"));
      return;
    }

    createWorkflowMutation.mutate(parsed.data, {
      onSuccess: (workflow) => {
        const triggerId = definition.trigger?.id ?? "";
        router.push(
          `/workspaces/${workspaceId}/workflows/${workflow.id}?new=1&node=${encodeURIComponent(triggerId)}`
        );
      },
      onError: (error) => {
        toast.error(getV3ApiErrorMessage(error, t("workspace.workflows.create_failed")));
      },
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" size="sm" loading={createWorkflowMutation.isPending}>
          {t("common.new_workflow")}
          <ChevronDownIcon />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 motion-reduce:animate-none">
        <DropdownMenuLabel className="text-xs font-medium text-slate-500">
          {t("workspace.workflows.new_workflow_triggered_by")}
        </DropdownMenuLabel>
        <DropdownMenuItem onClick={() => handleCreate(WORKFLOW_TRIGGERS.WEBHOOK)}>
          <WebhookIcon className="size-4" />
          {t("workspace.workflows.new_workflow_trigger_webhook")}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleCreate(WORKFLOW_TRIGGERS.RESPONSE_COMPLETED)}>
          <MessageCircleIcon className="size-4" />
          {t("workspace.workflows.new_workflow_trigger_responses")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
