"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import toast from "react-hot-toast";
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
import { updateWorkspaceAction } from "@/modules/workspaces/settings/actions";
import { deleteWorkspaceAction } from "@/modules/workspaces/settings/general/actions";
import { hasMatchingWorkspaceDeleteConfirmation } from "@/modules/workspaces/settings/general/lib/delete-workspace-confirmation";
import { getActionErrorMessage } from "../lib/action-result";

interface WorkspaceRowActionsProps {
  workspace: { id: string; name: string };
  /** The last workspace of an organization cannot be deleted. */
  isOnlyWorkspace: boolean;
}

type TDialogKind = "rename" | "delete";

export const WorkspaceRowActions = ({ workspace, isOnlyWorkspace }: Readonly<WorkspaceRowActionsProps>) => {
  const { t } = useTranslation();
  const router = useRouter();
  const [kind, setKind] = useState<TDialogKind>("rename");
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const openDialog = (next: TDialogKind) => {
    setValue(next === "rename" ? workspace.name : "");
    setError(null);
    setKind(next);
    setOpen(true);
  };

  const close = () => setOpen(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const result =
        kind === "rename"
          ? await updateWorkspaceAction({ workspaceId: workspace.id, data: { name: value.trim() } })
          : await deleteWorkspaceAction({ workspaceId: workspace.id, confirmationName: value });
      const message = getActionErrorMessage(result, t("common.something_went_wrong_please_try_again"));
      if (message) {
        setError(message);
        return;
      }
      toast.success(
        kind === "rename"
          ? t("shell.organization.workspaces.renamed")
          : t("shell.organization.workspaces.deleted")
      );
      close();
      router.refresh();
    } catch {
      setError(t("common.something_went_wrong_please_try_again"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const isRename = kind === "rename";
  const canSubmit = isRename
    ? value.trim().length > 0 && value.trim() !== workspace.name
    : hasMatchingWorkspaceDeleteConfirmation(value, workspace.name);

  return (
    <div className="flex justify-end gap-2">
      <Button variant="outline" size="sm" onClick={() => openDialog("rename")}>
        {t("common.rename")}
        <span className="sr-only">{workspace.name}</span>
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="text-slate-700"
        disabled={isOnlyWorkspace}
        title={isOnlyWorkspace ? t("shell.organization.workspaces.delete_last_blocked") : undefined}
        onClick={() => openDialog("delete")}>
        {t("common.delete")}
        <span className="sr-only">{workspace.name}</span>
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent width="narrow">
          <DialogHeader>
            <DialogTitle className="pr-6">
              {isRename
                ? t("shell.organization.workspaces.rename_title")
                : t("shell.organization.workspaces.delete_title", { name: workspace.name })}
            </DialogTitle>
            <DialogDescription>
              {isRename
                ? t("shell.organization.workspaces.rename_description")
                : t("shell.organization.workspaces.delete_description")}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col gap-4">
            <DialogBody className="flex flex-col gap-2 px-px py-1">
              <Label htmlFor={`workspace-${isRename ? "name" : "confirm"}-${workspace.id}`}>
                {isRename
                  ? t("shell.organization.workspaces.name")
                  : t("shell.organization.workspaces.delete_confirm_label", { name: workspace.name })}
              </Label>
              <Input
                id={`workspace-${isRename ? "name" : "confirm"}-${workspace.id}`}
                autoComplete="off"
                value={value}
                placeholder={isRename ? undefined : workspace.name}
                onChange={(event) => setValue(event.target.value)}
              />
              {error && (
                <p role="alert" className="text-sm text-red-700">
                  {error}
                </p>
              )}
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={close}>
                {t("common.cancel")}
              </Button>
              <Button
                type="submit"
                variant={isRename ? "default" : "destructive"}
                loading={isSubmitting}
                disabled={!canSubmit}>
                {isRename ? t("common.save") : t("shell.organization.workspaces.delete_workspace")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};
