"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { SubmitHandler, useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { ZUserPassword } from "@formbricks/types/user";
import { getFormattedErrorMessage } from "@/lib/utils/error-message";
import { AuthField } from "@/modules/auth/components/auth-field";
import { setupTwoFactorAuthAction } from "@/modules/ee/two-factor-auth/actions";
import { Button } from "@/modules/ui/components/button";
import { PasswordInput } from "@/modules/ui/components/password-input";
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
}: Readonly<ConfirmPasswordFormProps>) => {
  const form = useForm<TConfirmPasswordFormState>({
    defaultValues: {
      password: "",
    },
    resolver: zodResolver(ZConfirmPasswordFormState),
  });
  const { t } = useTranslation();

  const onSubmit: SubmitHandler<TConfirmPasswordFormState> = async (data) => {
    const setupTwoFactorAuthResponse = await setupTwoFactorAuthAction({ password: data.password });
    if (setupTwoFactorAuthResponse?.data) {
      const { backupCodes, dataUri, secret } = setupTwoFactorAuthResponse.data;
      setBackupCodes(backupCodes);
      setDataUri(dataUri);
      setSecret(secret);
      setCurrentStep("scanQRCode");
    } else {
      // Always surface something: getFormattedErrorMessage can resolve to an empty string for some
      // action errors, which would show a blank toast (the "spinner then nothing" symptom).
      const errorMessage = getFormattedErrorMessage(setupTwoFactorAuthResponse);
      toast.error(errorMessage || t("common.something_went_wrong_please_try_again"));
    }
  };

  return (
    <form className="flex flex-col gap-5" onSubmit={form.handleSubmit(onSubmit)}>
      <AuthField
        id="two-factor-password"
        label={t("common.password")}
        error={form.formState.errors.password?.message}>
        <PasswordInput
          id="two-factor-password"
          autoComplete="current-password"
          required
          {...form.register("password")}
        />
      </AuthField>

      <div className="flex w-full items-center justify-end gap-2">
        <Button variant="outline" type="button" onClick={() => setOpen(false)}>
          {t("common.cancel")}
        </Button>

        <Button loading={form.formState.isSubmitting}>{t("common.confirm")}</Button>
      </div>
    </form>
  );
};
