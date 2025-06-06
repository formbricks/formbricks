"use client";

import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { createOrganizationAction } from "@/modules/organization/actions";
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
import { useTranslate } from "@tolgee/react";
import { PlusCircleIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";

interface CreateOrganizationModalProps {
  open: boolean;
  setOpen: (v: boolean) => void;
}

type FormValues = {
  name: string;
};

export const CreateOrganizationModal = ({ open, setOpen }: CreateOrganizationModalProps) => {
  const { t } = useTranslate();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [organizationName, setOrganizationName] = useState("");
  const isOrganizationNameValid = organizationName.trim() !== "";
  const { register, handleSubmit } = useForm<FormValues>();

  const submitOrganization = async (data: FormValues) => {
    data.name = data.name.trim();
    if (!data.name) return;

    setLoading(true);
    const createOrganizationResponse = await createOrganizationAction({ organizationName: data.name });
    if (createOrganizationResponse?.data) {
      toast.success(t("environments.settings.general.organization_created_successfully"));
      router.push(`/organizations/${createOrganizationResponse.data.id}`);
      setOpen(false);
    } else {
      const errorMessage = getFormattedErrorMessage(createOrganizationResponse);
      toast.error(errorMessage);
      console.error(errorMessage);
    }

    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent disableCloseOnOutsideClick={true}>
        <DialogHeader>
          <PlusCircleIcon />
          <DialogTitle>{t("environments.settings.general.create_new_organization")}</DialogTitle>
          <DialogDescription>
            {t("environments.settings.general.create_new_organization_description")}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(submitOrganization)} className="gap-y-4">
          <DialogBody>
            <div className="grid w-full gap-y-2">
              <Label>{t("environments.settings.general.organization_name")}</Label>
              <Input
                autoFocus
                placeholder={t("environments.settings.general.organization_name_placeholder")}
                {...register("name", { required: true })}
                value={organizationName}
                onChange={(e) => setOrganizationName(e.target.value)}
              />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setOpen(false);
              }}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" loading={loading} disabled={!isOrganizationNameValid}>
              {t("environments.settings.general.create_new_organization")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
