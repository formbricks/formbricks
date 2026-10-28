"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { Button } from "@/modules/ui/components/button";
import { Card } from "@/modules/ui/components/card";
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
import { deleteOrganizationAction } from "../actions";
import { getActionErrorMessage } from "../lib/action-result";

interface DeleteOrganizationCardProps {
  organization: { id: string; name: string };
  /** Deleting an organization needs the multi-organization capability of the instance. */
  isDeletionAllowed: boolean;
}

export const DeleteOrganizationCard = ({
  organization,
  isDeletionAllowed,
}: Readonly<DeleteOrganizationCardProps>) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) {
      setConfirmation("");
      setError(null);
    }
  };

  const handleDelete = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setIsDeleting(true);
    try {
      const result = await deleteOrganizationAction({ organizationId: organization.id });
      const message = getActionErrorMessage(result, t("common.something_went_wrong_please_try_again"));
      if (message) {
        setError(message);
        setIsDeleting(false);
        return;
      }
      toast.success(t("shell.organization.security.delete_done"));
      // The organization is gone, so leave its pages; "/" resolves the next landing place.
      globalThis.location.assign("/");
    } catch {
      setError(t("common.something_went_wrong_please_try_again"));
      setIsDeleting(false);
    }
  };

  return (
    <Card className="flex flex-col gap-4 border-red-200 p-6">
      <div className="max-w-[68ch]">
        <h2 className="text-base font-semibold text-slate-800">
          {t("shell.organization.security.delete_title")}
        </h2>
        <p className="mt-0.5 text-slate-600">
          {t("shell.organization.security.delete_description", { name: organization.name })}
        </p>
      </div>
      {isDeletionAllowed ? (
        <div>
          <Button variant="destructive" onClick={() => setOpen(true)}>
            {t("shell.organization.security.delete_organization")}
          </Button>
        </div>
      ) : (
        <p className="text-slate-500">{t("shell.organization.security.delete_unavailable")}</p>
      )}

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent width="narrow">
          <DialogHeader>
            <DialogTitle className="pr-6">{t("shell.organization.security.delete_organization")}</DialogTitle>
            <DialogDescription>{t("shell.organization.security.delete_warning")}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleDelete} className="flex min-h-0 flex-1 flex-col gap-4">
            <DialogBody className="flex flex-col gap-2 px-px py-1">
              <Label htmlFor="delete-organization-confirmation">
                {t("shell.organization.security.delete_confirm_label", { name: organization.name })}
              </Label>
              <Input
                id="delete-organization-confirmation"
                autoComplete="off"
                value={confirmation}
                placeholder={organization.name}
                onChange={(event) => setConfirmation(event.target.value)}
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
              <Button
                type="submit"
                variant="destructive"
                loading={isDeleting}
                disabled={confirmation !== organization.name}>
                {t("shell.organization.security.delete_organization")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
};
