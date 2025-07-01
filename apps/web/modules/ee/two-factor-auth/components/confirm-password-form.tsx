"use client";

import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { setupTwoFactorAuthAction } from "@/modules/ee/two-factor-auth/actions";
import { Button } from "@/modules/ui/components/button";
import { FormControl, FormError, FormField, FormItem } from "@/modules/ui/components/form";
import { PasswordInput } from "@/modules/ui/components/password-input";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslate } from "@tolgee/react";
import { FormProvider, SubmitHandler, useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { z } from "zod";
import { ZUserPassword } from "@formbricks/types/user";
import { EnableTwoFactorModalStep } from "./enable-two-factor-modal";

const ZConfirmPasswordFormState = z.object({
  password: ZUserPassword,
});
type TConfirmPasswordFormState = z.infer<typeof ZConfirmPasswordFormState>;

interface ConfirmPasswordFormProps {
  setCurrentStep: (step: EnableTwoFactorModalStep) => void;
  setBackupCodes: (codes: string[]) => void;
  setDataUri: (dataUri: string) => void;
  setSecret: (secret: string) => void;
  setOpen: (open: boolean) => void;
}
export const ConfirmPasswordForm = ({
  setBackupCodes,
  setCurrentStep,
  setDataUri,
  setSecret,
  setOpen,
}: ConfirmPasswordFormProps) => {
  const form = useForm<TConfirmPasswordFormState>({
    defaultValues: {
      password: "",
    },
    resolver: zodResolver(ZConfirmPasswordFormState),
  });
  const { handleSubmit } = form;
  const { t } = useTranslate();

  const onSubmit: SubmitHandler<TConfirmPasswordFormState> = async (data) => {
    const setupTwoFactorAuthResponse = await setupTwoFactorAuthAction({ password: data.password });
    if (setupTwoFactorAuthResponse?.data) {
      const { backupCodes, dataUri, secret } = setupTwoFactorAuthResponse.data;
      setBackupCodes(backupCodes);
      setDataUri(dataUri);
      setSecret(secret);
      setCurrentStep("scanQRCode");
    } else {
      const errorMessage = getFormattedErrorMessage(setupTwoFactorAuthResponse);
      toast.error(errorMessage);
    }
  };

  return (
    <FormProvider {...form}>
      <form className="flex flex-col space-y-4" onSubmit={handleSubmit(onSubmit)}>
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

        <div className="flex w-full items-center justify-end space-x-2">
          <Button variant="secondary" size="sm" type="button" onClick={() => setOpen(false)}>
            {t("common.cancel")}
          </Button>

          <Button size="sm" loading={form.formState.isSubmitting}>
            {t("common.confirm")}
          </Button>
        </div>
      </form>
    </FormProvider>
  );
};
