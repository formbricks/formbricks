"use client";

import { PlusIcon } from "lucide-react";
import { useRouter, useSelectedLayoutSegment } from "next/navigation";
import { useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { ZCreateWorkflowInput } from "@formbricks/workflows";
import { getV3ApiErrorMessage } from "@/modules/api/lib/v3-client";
import { Button } from "@/modules/ui/components/button";
import { useCreateWorkflow } from "../hooks/use-create-workflow";
import { createDefaultWorkflowDefinition } from "../lib/default-workflow";
import { CreateWorkflowDialog } from "./create-workflow-dialog";

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

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  if (segment !== null || isReadOnly) {
    return null;
  }

  const handleOpenChange = (open: boolean) => {
    setIsDialogOpen(open);
    if (!open) {
      setName("");
      setDescription("");
    }
  };

  const handleCreate = () => {
    const parsed = ZCreateWorkflowInput.safeParse({
      workspaceId,
      name: name.trim(),
      description: description.trim() || null,
      status: "draft",
      definition: createDefaultWorkflowDefinition(),
    });

    if (!parsed.success) {
      toast.error(t("workspace.workflows.create_failed"));
      return;
    }

    createWorkflowMutation.mutate(parsed.data, {
      onSuccess: (workflow) => {
        toast.success(t("workspace.workflows.create_success"));
        handleOpenChange(false);
        router.push(`/workspaces/${workspaceId}/workflows/${workflow.id}`);
      },
      onError: (error) => {
        toast.error(getV3ApiErrorMessage(error, t("workspace.workflows.create_failed")));
      },
    });
  };

  return (
    <>
      <Button type="button" size="sm" onClick={() => setIsDialogOpen(true)}>
        <PlusIcon />
        {t("common.new_workflow")}
      </Button>
      <CreateWorkflowDialog
        open={isDialogOpen}
        onOpenChange={handleOpenChange}
        name={name}
        description={description}
        onNameChange={setName}
        onDescriptionChange={setDescription}
        onSubmit={handleCreate}
        isCreating={createWorkflowMutation.isPending}
      />
    </>
  );
};
