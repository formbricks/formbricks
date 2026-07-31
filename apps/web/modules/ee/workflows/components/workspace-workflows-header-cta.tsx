"use client";

import { PlusIcon } from "lucide-react";
import { useRouter, useSelectedLayoutSegment } from "next/navigation";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { ZCreateWorkflowInput } from "@formbricks/workflows";
import { getV3ApiErrorMessage } from "@/modules/api/lib/v3-client";
import { Button } from "@/modules/ui/components/button";
import { useCreateWorkflow } from "../hooks/use-create-workflow";
import { createEmptyWorkflowDefinition } from "../lib/default-workflow";

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

  // No dialog: create the draft immediately with a default name and an empty canvas, then land
  // the user in the editor where the title is focused for renaming (the ?new=1 flag drives that).
  const handleCreate = () => {
    if (createWorkflowMutation.isPending) return;

    const parsed = ZCreateWorkflowInput.safeParse({
      workspaceId,
      name: t("common.new_workflow"),
      description: null,
      status: "draft",
      definition: createEmptyWorkflowDefinition(),
    });

    if (!parsed.success) {
      toast.error(t("workspace.workflows.create_failed"));
      return;
    }

    createWorkflowMutation.mutate(parsed.data, {
      onSuccess: (workflow) => {
        router.push(`/workspaces/${workspaceId}/workflows/${workflow.id}?new=1`);
      },
      onError: (error) => {
        toast.error(getV3ApiErrorMessage(error, t("workspace.workflows.create_failed")));
      },
    });
  };

  return (
    <Button type="button" size="sm" loading={createWorkflowMutation.isPending} onClick={handleCreate}>
      {t("common.new_workflow")}
      <PlusIcon />
    </Button>
  );
};
