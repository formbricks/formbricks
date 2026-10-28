"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Controller, SubmitHandler, useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { ZUserPassword } from "@formbricks/types/user";
import { getFormattedErrorMessage } from "@/lib/utils/error-message";
import { AuthField } from "@/modules/auth/components/auth-field";
import { OTPInput } from "@/modules/auth/components/otp-input";
import { disableTwoFactorAuthAction } from "@/modules/ee/two-factor-auth/actions";
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
import { PasswordInput } from "@/modules/ui/components/password-input";

const ZDisableTwoFactorFormState = z
  .object({
    password: ZUserPassword,
    code: z.string().optional(),
    backupCode: z.string().optional(),
  })
  .refine((data) => (!!data.code && !data.backupCode) || (!data.code && !!data.backupCode), {
    path: ["code"],
    error: "Please provide either the code OR the backup code",
  });

type TDisableTwoFactorFormState = z.infer<typeof ZDisableTwoFactorFormState>;

interface DisableTwoFactorModalProps {
  open: boolean;
  setOpen: (open: boolean) => void;
}

export const DisableTwoFactorModal = ({ open, setOpen }: Readonly<DisableTwoFactorModalProps>) => {
  const router = useRouter();
  const form = useForm<TDisableTwoFactorFormState>({
    defaultValues: {
      password: "",
      code: "",
      backupCode: "",
    },
    resolver: zodResolver(ZDisableTwoFactorFormState),
  });
  const { t } = useTranslation();
  const [backupCodeInputVisible, setBackupCodeInputVisible] = useState(false);

  const onSubmit: SubmitHandler<TDisableTwoFactorFormState> = async (data) => {
    const { code, password, backupCode } = data;
    const disableTwoFactorAuthResponse = await disableTwoFactorAuthAction({ code, password, backupCode });
    if (disableTwoFactorAuthResponse?.data) {
      toast.success(disableTwoFactorAuthResponse.data.message);
      router.refresh();
      form.reset();
      setOpen(false);
    } else {
      const errorMessage = getFormattedErrorMessage(disableTwoFactorAuthResponse);
      toast.error(errorMessage);
    }
  };

  const { errors } = form.formState;

  return (
    <Dialog
      open={open}
      onOpenChange={(open) => {
        if (!open) {
          form.reset();
        }
        setOpen(open);
      }}>
      <DialogContent width="narrow">
        <DialogHeader>
          <DialogTitle>{t("workspace.settings.profile.disable_two_factor_authentication")}</DialogTitle>
          <DialogDescription>
            {t("workspace.settings.profile.disable_two_factor_authentication_description")}
          </DialogDescription>
        </DialogHeader>

        <form className="flex flex-col gap-5" onSubmit={form.handleSubmit(onSubmit)}>
          <DialogBody className="flex flex-col gap-5 px-1">
            <AuthField
              id="disable-two-factor-password"
              label={t("common.password")}
              error={errors.password?.message}>
              <PasswordInput
                id="disable-two-factor-password"
                autoComplete="current-password"
                required
                {...form.register("password")}
              />
            </AuthField>

            <AuthField
              id={backupCodeInputVisible ? "disable-two-factor-backup-code" : "disable-two-factor-code"}
              label={
                backupCodeInputVisible
                  ? t("workspace.settings.profile.backup_code")
                  : t("workspace.settings.profile.two_factor_code")
              }
              hint={
                backupCodeInputVisible
                  ? t(
                      "workspace.settings.profile.each_backup_code_can_be_used_exactly_once_to_grant_access_without_your_authenticator"
                    )
                  : t(
                      "workspace.settings.profile.two_factor_authentication_enabled_please_enter_the_six_digit_code_from_your_authenticator_app"
                    )
              }
              error={errors.code?.message}>
              {backupCodeInputVisible ? (
                <Input
                  id="disable-two-factor-backup-code"
                  autoComplete="off"
                  placeholder="XXXXX-XXXXX"
                  {...form.register("backupCode")}
                />
              ) : (
                <Controller
                  control={form.control}
                  name="code"
                  render={({ field }) => (
                    <OTPInput
                      value={field.value ?? ""}
                      valueLength={6}
                      onChange={field.onChange}
                      containerClassName="justify-start"
                    />
                  )}
                />
              )}
            </AuthField>
          </DialogBody>

          <DialogFooter className="items-center sm:justify-between">
            <Button variant="ghost" type="button" onClick={() => setBackupCodeInputVisible((prev) => !prev)}>
              {backupCodeInputVisible ? t("common.go_back") : t("workspace.settings.profile.lost_access")}
            </Button>
            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <Button
                variant="outline"
                type="button"
                onClick={() => {
                  form.reset();
                  setOpen(false);
                }}>
                {t("common.cancel")}
              </Button>

              <Button variant="destructive" loading={form.formState.isSubmitting}>
                {t("common.disable")}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
