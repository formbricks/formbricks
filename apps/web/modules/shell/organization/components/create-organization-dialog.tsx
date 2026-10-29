"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
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
import {
  createOrganization,
  getCreateOrganizationErrorMessage,
  getNewOrganizationPath,
} from "../lib/create-organization-client";

interface CreateOrganizationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * A name field and nothing else: the server makes the person the owner and creates no workspace, then the
 * Connect page of the new organization hands them the setup prompt.
 */
export const CreateOrganizationDialog = ({ open, onOpenChange }: Readonly<CreateOrganizationDialogProps>) => {
  const { t } = useTranslation();
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleOpenChange = (next: boolean) => {
    if (isSubmitting) return;
    onOpenChange(next);
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
      const organization = await createOrganization(name);
      // Stay in the loading state until the new page replaces this one.
      router.push(getNewOrganizationPath(organization.id));
    } catch (caught) {
      setError(getCreateOrganizationErrorMessage(caught, t("shell.create_organization.error_fallback")));
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent width="narrow">
        <DialogHeader>
          <DialogTitle className="pr-6">{t("shell.create_organization.title")}</DialogTitle>
          <DialogDescription>{t("shell.create_organization.description")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col gap-4">
          <DialogBody className="flex flex-col gap-2 px-px py-1">
            <Label htmlFor="new-organization-name">{t("shell.create_organization.name")}</Label>
            <Input
              id="new-organization-name"
              autoComplete="off"
              maxLength={255}
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
  );
};
