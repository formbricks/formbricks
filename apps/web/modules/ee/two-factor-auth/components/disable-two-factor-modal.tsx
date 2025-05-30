"use client";

import { getFormattedErrorMessage } from "@/lib/utils/helper";
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
import { FormControl, FormError, FormField, FormItem } from "@/modules/ui/components/form";
import { Input } from "@/modules/ui/components/input";
import { OTPInput } from "@/modules/ui/components/otp-input";
import { PasswordInput } from "@/modules/ui/components/password-input";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslate } from "@tolgee/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { FormProvider, SubmitHandler, useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { z } from "zod";
import { ZUserPassword } from "@formbricks/types/user";

const ZDisableTwoFactorFormState = z
  .object({
    password: ZUserPassword,
    code: z.string().optional(),
    backupCode: z.string().optional(),
  })
  .refine((data) => (!!data.code && !data.backupCode) || (!data.code && !!data.backupCode), {
    message: "Please provide either the code OR the backup code",
    path: ["code"],
  });

type TDisableTwoFactorFormState = z.infer<typeof ZDisableTwoFactorFormState>;

interface DisableTwoFactorModalProps {
  open: boolean;
  setOpen: (open: boolean) => void;
}

export const DisableTwoFactorModal = ({ open, setOpen }: DisableTwoFactorModalProps) => {
  const router = useRouter();
  const form = useForm<TDisableTwoFactorFormState>({
    defaultValues: {
      password: "",
      code: "",
      backupCode: "",
    },
    resolver: zodResolver(ZDisableTwoFactorFormState),
  });
  const { t } = useTranslate();
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

  return (
    <Dialog
      open={open}
      onOpenChange={() => {
        form.reset();
        setOpen(false);
      }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("environments.settings.profile.disable_two_factor_authentication")}</DialogTitle>
          <DialogDescription>
            {t("environments.settings.profile.disable_two_factor_authentication_description")}
          </DialogDescription>
        </DialogHeader>

        <FormProvider {...form}>
          <form className="flex flex-col space-y-6" onSubmit={form.handleSubmit(onSubmit)}>
            <DialogBody className="space-y-6">
              <div className="flex flex-col gap-2">
                <label htmlFor="password" className="text-sm font-medium text-slate-700">
                  {t("common.password")}
                </label>
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field, fieldState: { error } }) => (
                    <FormItem className="w-full">
                      <FormControl>
                        <FormItem>
                          <PasswordInput
                            id="password"
                            autoComplete="current-password"
                            placeholder="*******"
                            aria-placeholder="password"
                            required
                            onChange={(password) => field.onChange(password)}
                            value={field.value}
                            className="focus:border-brand-dark focus:ring-brand-dark block w-full rounded-md border-slate-300 shadow-sm sm:text-sm"
                          />
                          {error?.message && <FormError className="text-left">{error.message}</FormError>}
                        </FormItem>
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>

              <div>
                <div className="flex flex-col gap-2">
                  <label htmlFor="code" className="text-sm font-medium text-slate-700">
                    {backupCodeInputVisible
                      ? t("environments.settings.profile.backup_code")
                      : t("environments.settings.profile.two_factor_code")}
                  </label>

                  <p className="text-sm text-slate-700">
                    {backupCodeInputVisible
                      ? t(
                          "environments.settings.profile.each_backup_code_can_be_used_exactly_once_to_grant_access_without_your_authenticator"
                        )
                      : t(
                          "environments.settings.profile.two_factor_authentication_enabled_please_enter_the_six_digit_code_from_your_authenticator_app"
                        )}
                  </p>
                </div>

                {backupCodeInputVisible ? (
                  <FormField
                    control={form.control}
                    name="backupCode"
                    render={({ field, fieldState: { error } }) => (
                      <FormItem className="w-full">
                        <FormControl>
                          <FormItem>
                            <Input {...field} placeholder="XXXXX-XXXXX" className="mt-2" />
                            {error?.message && <FormError className="text-left">{error.message}</FormError>}
                          </FormItem>
                        </FormControl>
                      </FormItem>
                    )}
                  />
                ) : (
                  <FormField
                    control={form.control}
                    name="code"
                    render={({ field, fieldState: { error } }) => (
                      <FormItem className="w-full">
                        <FormControl>
                          <FormItem>
                            <OTPInput
                              value={field.value || ""}
                              valueLength={6}
                              onChange={field.onChange}
                              containerClassName="justify-start mt-4"
                            />
                            {error?.message && <FormError className="text-left">{error.message}</FormError>}
                          </FormItem>
                        </FormControl>
                      </FormItem>
                    )}
                  />
                )}
              </div>
            </DialogBody>

            <DialogFooter className="flex w-full items-center justify-between">
              <div>
                <Button
                  variant="ghost"
                  type="button"
                  onClick={() => setBackupCodeInputVisible((prev) => !prev)}>
                  {backupCodeInputVisible
                    ? t("common.go_back")
                    : t("environments.settings.profile.lost_access")}
                </Button>
              </div>
              <div className="flex items-center space-x-4">
                <Button
                  variant="secondary"
                  type="button"
                  onClick={() => {
                    form.reset();
                    setOpen(false);
                  }}>
                  {t("common.cancel")}
                </Button>

                <Button loading={form.formState.isSubmitting}>{t("common.disable")}</Button>
              </div>
            </DialogFooter>
          </form>
        </FormProvider>
      </DialogContent>
    </Dialog>
  );
};
