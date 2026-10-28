"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter, useSearchParams } from "next/navigation";
import { SubmitHandler, useForm } from "react-hook-form";
import { toast } from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import {
  INVALID_PASSWORD_RESET_TOKEN_ERROR_CODE,
  PASSWORD_COMPROMISED_ERROR_CODE,
} from "@formbricks/types/errors";
import { ZUserPassword } from "@formbricks/types/user";
import { getFormattedErrorMessage } from "@/lib/utils/error-message";
import { AuthField } from "@/modules/auth/components/auth-field";
import { resetPasswordAction } from "@/modules/auth/forgot-password/reset/actions";
import { PasswordChecks } from "@/modules/auth/signup/components/password-checks";
import { Button } from "@/modules/ui/components/button";
import { PasswordInput } from "@/modules/ui/components/password-input";

const ZPasswordResetForm = z.object({
  password: ZUserPassword,
  confirmPassword: ZUserPassword,
});

type TPasswordResetForm = z.infer<typeof ZPasswordResetForm>;

export const ResetPasswordForm = () => {
  const { t } = useTranslation();
  const searchParams = useSearchParams();
  const router = useRouter();

  const form = useForm<TPasswordResetForm>({
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
    resolver: zodResolver(ZPasswordResetForm),
  });

  const handleSubmit: SubmitHandler<TPasswordResetForm> = async (data) => {
    if (data.password !== data.confirmPassword) {
      toast.error(t("auth.forgot-password.reset.passwords_do_not_match"));
      return;
    }
    const token = searchParams?.get("token");
    if (!token) {
      toast.error(t("auth.forgot-password.reset.no_token_provided"));
      return;
    }
    const resetPasswordResponse = await resetPasswordAction({ token, password: data.password });
    if (resetPasswordResponse?.data) {
      router.push("/auth/forgot-password/reset/success");
    } else {
      const errorMessage = getFormattedErrorMessage(resetPasswordResponse);
      if (errorMessage === PASSWORD_COMPROMISED_ERROR_CODE) {
        toast.error(t("auth.password_compromised"));
        return;
      }
      toast.error(
        errorMessage === INVALID_PASSWORD_RESET_TOKEN_ERROR_CODE
          ? t("c.link_expired_description")
          : errorMessage
      );
    }
  };

  const { errors } = form.formState;

  return (
    <form onSubmit={form.handleSubmit(handleSubmit)} className="flex flex-col gap-4">
      <AuthField
        id="reset-password"
        label={t("auth.forgot-password.reset.new_password")}
        error={errors.password?.message}>
        <PasswordInput
          id="reset-password"
          autoComplete="new-password"
          required
          {...form.register("password")}
        />
        <PasswordChecks password={form.watch("password")} />
      </AuthField>
      <AuthField
        id="reset-confirm-password"
        label={t("auth.forgot-password.reset.confirm_password")}
        error={errors.confirmPassword?.message}>
        <PasswordInput
          id="reset-confirm-password"
          autoComplete="new-password"
          required
          {...form.register("confirmPassword")}
        />
      </AuthField>
      <Button
        type="submit"
        disabled={!form.formState.isValid}
        className="h-11 w-full justify-center sm:h-9"
        loading={form.formState.isSubmitting}>
        {t("shell.auth.reset_password.submit")}
      </Button>
    </form>
  );
};
