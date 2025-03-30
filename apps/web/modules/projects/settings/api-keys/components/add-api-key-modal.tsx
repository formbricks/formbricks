"use client";

import { Alert, AlertTitle } from "@/modules/ui/components/alert";
import { Button } from "@/modules/ui/components/button";
import { Input } from "@/modules/ui/components/input";
import { Label } from "@/modules/ui/components/label";
import { Modal } from "@/modules/ui/components/modal";
import { useTranslate } from "@tolgee/react";
import { useForm } from "react-hook-form";

interface MemberModalProps {
  open: boolean;
  setOpen: (v: boolean) => void;
  onSubmit: (data: { label: string; environment: string }) => void;
}

export const AddApiKeyModal = ({ open, setOpen, onSubmit }: MemberModalProps) => {
  const { t } = useTranslate();
  const { register, getValues, handleSubmit, reset } = useForm<{ label: string; environment: string }>();

  const submitAPIKey = async () => {
    const data = getValues();
    onSubmit(data);
    setOpen(false);
    reset();
  };

  return (
    <Modal open={open} setOpen={setOpen} noPadding closeOnOutsideClick={false}>
      <div className="flex h-full flex-col rounded-lg">
        <div className="rounded-t-lg bg-slate-100">
          <div className="flex items-center justify-between p-6">
            <div className="flex items-center space-x-2">
              <div className="text-xl font-medium text-slate-700">
                {t("environments.project.api-keys.add_api_key")}
              </div>
            </div>
          </div>
        </div>
        <form onSubmit={handleSubmit(submitAPIKey)}>
          <div className="flex justify-between rounded-lg p-6">
            <div className="w-full space-y-4">
              <div>
                <Label>{t("environments.project.api-keys.api_key_label")}</Label>
                <Input
                  placeholder="e.g. GitHub, PostHog, Slack"
                  {...register("label", { required: true, validate: (value) => value.trim() !== "" })}
                />
              </div>

              <Alert variant="warning" size="small">
                <AlertTitle>{t("environments.project.api-keys.api_key_security_warning")}</AlertTitle>
              </Alert>
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
              <Button type="submit">{t("environments.project.api-keys.add_api_key")}</Button>
            </div>
          </div>
        </form>
      </div>
    </Modal>
  );
};
