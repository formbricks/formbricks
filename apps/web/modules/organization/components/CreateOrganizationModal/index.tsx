"use client";

import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { createOrganizationAction } from "@/modules/organization/actions";
import { Button } from "@/modules/ui/components/button";
import { Input } from "@/modules/ui/components/input";
import { Label } from "@/modules/ui/components/label";
import { Modal } from "@/modules/ui/components/modal";
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
    <Modal open={open} setOpen={setOpen} noPadding closeOnOutsideClick={false}>
      <div className="flex h-full flex-col rounded-lg">
        <div className="rounded-t-lg bg-slate-100">
          <div className="flex items-center justify-between p-6">
            <div className="flex items-center space-x-2">
              <div className="mr-1.5 h-10 w-10 text-slate-500">
                <PlusCircleIcon className="h-5 w-5" />
              </div>
              <div>
                <div className="text-xl font-medium text-slate-700">
                  {t("environments.settings.general.create_new_organization")}
                </div>
                <div className="text-sm text-slate-500">
                  {t("environments.settings.general.create_new_organization_description")}
                </div>
              </div>
            </div>
          </div>
        </div>
        <form onSubmit={handleSubmit(submitOrganization)}>
          <div className="flex w-full justify-between space-y-4 rounded-lg p-6">
            <div className="grid w-full gap-x-2">
              <div>
                <Label>{t("environments.settings.general.organization_name")}</Label>
                <Input
                  autoFocus
                  placeholder={t("environments.settings.general.organization_name_placeholder")}
                  {...register("name", { required: true })}
                  value={organizationName}
                  onChange={(e) => setOrganizationName(e.target.value)}
                />
              </div>
            </div>
          </div>
          <div className="flex justify-end border-t border-slate-200 p-6">
            <div className="flex space-x-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setOpen(false);
                }}>
                {t("common.cancel")}
              </Button>
              <Button type="submit" loading={loading} disabled={!isOrganizationNameValid}>
                {t("environments.settings.general.create_new_organization")}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </Modal>
  );
};
