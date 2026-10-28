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
import { createWorkspaceAction } from "../actions";
import { getActionErrorMessage } from "../lib/action-result";

export const CreateWorkspaceDialog = ({
  organizationId,
  isLimitReached,
}: Readonly<{ organizationId: string; isLimitReached: boolean }>) => {
  const { t } = useTranslation();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) {
      setName("");
      setError(null);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const result = await createWorkspaceAction({ organizationId, data: { name: name.trim() } });
      const message = getActionErrorMessage(result, t("common.something_went_wrong_please_try_again"));
      if (message) {
        setError(message);
        return;
      }
      toast.success(t("shell.organization.workspaces.created"));
      handleOpenChange(false);
      router.refresh();
    } catch {
      setError(t("common.something_went_wrong_please_try_again"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Button onClick={() => setOpen(true)} disabled={isLimitReached}>
        {t("shell.organization.workspaces.create_workspace")}
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent width="narrow">
          <DialogHeader>
            <DialogTitle className="pr-6">{t("shell.organization.workspaces.create_workspace")}</DialogTitle>
            <DialogDescription>{t("shell.organization.workspaces.create_description")}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col gap-4">
            <DialogBody className="flex flex-col gap-2 px-px py-1">
              <Label htmlFor="new-workspace-name">{t("shell.organization.workspaces.name")}</Label>
              <Input
                id="new-workspace-name"
                autoComplete="off"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
              {error && (
                <p role="alert" className="text-sm text-red-700">
                  {error}
                </p>
              )}
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                {t("common.cancel")}
              </Button>
              <Button type="submit" loading={isSubmitting} disabled={name.trim().length === 0}>
                {t("common.create")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
};
