"use client";

import { useTranslation } from "react-i18next";
import { Button } from "@/modules/ui/components/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/modules/ui/components/dialog";
import { Input } from "@/modules/ui/components/input";
import { Label } from "@/modules/ui/components/label";

type TCreateWorkflowDialogProps = Readonly<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workflowName: string;
  workflowDescription: string;
  onWorkflowNameChange: (name: string) => void;
  onWorkflowDescriptionChange: (description: string) => void;
  onCreate: () => void;
  isCreating: boolean;
}>;

export const CreateWorkflowDialog = ({
  open,
  onOpenChange,
  workflowName,
  workflowDescription,
  onWorkflowNameChange,
  onWorkflowDescriptionChange,
  onCreate,
  isCreating,
}: TCreateWorkflowDialogProps) => {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent width="narrow">
        <DialogHeader>
          <DialogTitle>{t("workspace.workflows.create_workflow")}</DialogTitle>
          <DialogDescription>{t("workspace.workflows.create_workflow_description")}</DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (workflowName.trim() && !isCreating) {
              onCreate();
            }
          }}
          className="space-y-4">
          <DialogBody className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="workflow-name">{t("workspace.workflows.workflow_name")}</Label>
              <Input
                id="workflow-name"
                placeholder={t("workspace.workflows.workflow_name_placeholder")}
                value={workflowName}
                onChange={(event) => onWorkflowNameChange(event.target.value)}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="workflow-description">
                {t("workspace.workflows.workflow_description_optional")}
              </Label>
              <Input
                id="workflow-description"
                placeholder={t("workspace.workflows.workflow_description_placeholder")}
                value={workflowDescription}
                onChange={(event) => onWorkflowDescriptionChange(event.target.value)}
              />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => onOpenChange(false)}
              disabled={isCreating}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" loading={isCreating} disabled={!workflowName.trim()}>
              {t("common.create")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
