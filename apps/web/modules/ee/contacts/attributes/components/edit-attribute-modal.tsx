"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { TContactAttributeKey } from "@formbricks/types/contact-attribute-key";
import { getFormattedErrorMessage } from "@/lib/utils/helper";
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
import { updateContactAttributeKeyAction } from "../actions";

interface EditAttributeModalProps {
  attribute: TContactAttributeKey;
  open: boolean;
  setOpen: (open: boolean) => void;
}

export function EditAttributeModal({ attribute, open, setOpen }: Readonly<EditAttributeModalProps>) {
  const { t } = useTranslation();
  const router = useRouter();
  const [isUpdating, setIsUpdating] = useState(false);
  const [formData, setFormData] = useState({
    name: attribute.name ?? "",
    description: attribute.description ?? "",
  });

  const handleUpdate = async () => {
    setIsUpdating(true);
    const updateContactAttributeKeyResponse = await updateContactAttributeKeyAction({
      id: attribute.id,
      name: formData.name || undefined,
      description: formData.description || undefined,
    });

    if (!updateContactAttributeKeyResponse?.data) {
      const errorMessage = getFormattedErrorMessage(updateContactAttributeKeyResponse);
      toast.error(errorMessage);
      setIsUpdating(false);
      return;
    }

    toast.success(t("environments.contacts.attribute_updated_successfully"));
    setOpen(false);
    router.refresh();
    setIsUpdating(false);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    await handleUpdate();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("environments.contacts.edit_attribute")}</DialogTitle>
          <DialogDescription>{t("environments.contacts.edit_attribute_description")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <DialogBody>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-slate-900">
                  {t("environments.contacts.attribute_key")}
                </label>
                <Input value={attribute.key} disabled className="bg-slate-50" />
                <p className="text-xs text-slate-500">
                  {t("environments.contacts.attribute_key_cannot_be_changed")}
                </p>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-slate-900">
                  {t("environments.contacts.attribute_label")}
                </label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder={t("environments.contacts.attribute_label_placeholder")}
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-slate-900">
                  {t("environments.contacts.attribute_description")} ({t("common.optional")})
                </label>
                <Input
                  value={formData.description}
                  onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                  placeholder={t("environments.contacts.attribute_description_placeholder")}
                />
              </div>
            </div>
          </DialogBody>

          <DialogFooter className="mt-4">
            <Button onClick={() => setOpen(false)} type="button" variant="secondary">
              {t("common.cancel")}
            </Button>
            <Button disabled={!formData.name} loading={isUpdating} type="submit">
              {t("common.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
