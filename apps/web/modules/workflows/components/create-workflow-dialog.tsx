"use client";

import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
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
import {
  WORKFLOW_DESCRIPTION_MAX_LENGTH,
  WORKFLOW_NAME_MAX_LENGTH,
  validateCreateWorkflowForm,
} from "../lib/validate-create-workflow";

interface CreateWorkflowDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  name: string;
  description: string;
  onNameChange: (name: string) => void;
  onDescriptionChange: (description: string) => void;
  onSubmit: () => void;
  isCreating: boolean;
}

/**
 * Create-workflow dialog. Local UI state (name/description, open) is owned by the parent and
 * threaded in; this component validates name (1–120) and description (≤500) client-side before the
 * submit fires, supports submit-on-enter, and reflects `isCreating` from the create mutation.
 */
export const CreateWorkflowDialog = ({
  open,
  onOpenChange,
  name,
  description,
  onNameChange,
  onDescriptionChange,
  onSubmit,
  isCreating,
}: Readonly<CreateWorkflowDialogProps>) => {
  const { t } = useTranslation();

  const { errors, isValid } = validateCreateWorkflowForm(name, description);
  const nameError = errors.nameTooLong
    ? t("workspace.workflows.name_too_long", { max: WORKFLOW_NAME_MAX_LENGTH })
    : null;
  const descriptionError = errors.descriptionTooLong
    ? t("workspace.workflows.description_too_long", { max: WORKFLOW_DESCRIPTION_MAX_LENGTH })
    : null;

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
            if (isValid && !isCreating) {
              onSubmit();
            }
          }}>
          <DialogBody className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="workflow-name">{t("common.workflow_name")}</Label>
              <Input
                id="workflow-name"
                name="workflow-name"
                placeholder={t("workspace.workflows.workflow_name_placeholder")}
                value={name}
                isInvalid={Boolean(nameError)}
                onChange={(event) => onNameChange(event.target.value)}
                autoFocus
              />
              {nameError ? <p className="text-sm text-red-500">{nameError}</p> : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="workflow-description">
                {t("workspace.workflows.workflow_description_optional")}
              </Label>
              <textarea
                id="workflow-description"
                name="workflow-description"
                rows={3}
                placeholder={t("workspace.workflows.workflow_description_placeholder")}
                value={description}
                onChange={(event) => onDescriptionChange(event.target.value)}
                className={cn(
                  "flex min-h-20 w-full resize-none rounded-md border bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-1 disabled:cursor-not-allowed disabled:bg-slate-50",
                  descriptionError ? "border-red-500" : "border-slate-300"
                )}
              />
              {descriptionError ? <p className="text-sm text-red-500">{descriptionError}</p> : null}
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
            <Button type="submit" loading={isCreating} disabled={!isValid}>
              {t("common.create")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
