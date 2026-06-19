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

/**
 * Header create action for the workflows list. Read-only members never see it; the runs tab never
 * shows it (the create CTA belongs only to the list index segment). Owns the dialog's local
 * `useState` and drives the create mutation: it builds a Scope-1-valid draft definition, validates
 * the full `ZCreateWorkflowInput` before POST, then routes to the editor on success.
 */
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

  // The create CTA only belongs to the workflows list tab (the index segment); the runs tab has no
  // CTA, and read-only members can never create.
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
