"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { SubmitHandler, useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { getFormattedErrorMessage } from "@/lib/utils/error-message";
import { AuthField } from "@/modules/auth/components/auth-field";
import { forgotPasswordAction } from "@/modules/auth/forgot-password/actions";
import { Button } from "@/modules/ui/components/button";
import { Input } from "@/modules/ui/components/input";

const ZForgotPasswordForm = z.object({
  email: z.email(),
});

type TForgotPasswordForm = z.infer<typeof ZForgotPasswordForm>;

export const ForgotPasswordForm = () => {
  const router = useRouter();
  const { t } = useTranslation();
  const form = useForm<TForgotPasswordForm>({
    defaultValues: {
      email: "",
    },
    resolver: zodResolver(ZForgotPasswordForm),
  });

  const handleSubmit: SubmitHandler<TForgotPasswordForm> = async (data) => {
    const forgotPasswordResponse = await forgotPasswordAction({ email: data.email });
    if (forgotPasswordResponse?.data) {
      router.push("/auth/forgot-password/email-sent");
    } else {
      const errorMessage = getFormattedErrorMessage(forgotPasswordResponse);
      toast.error(errorMessage);
    }
  };

  const { errors } = form.formState;

  return (
    <form onSubmit={form.handleSubmit(handleSubmit)} className="flex flex-col gap-4">
      <AuthField id="forgot-email" label={t("common.email")} error={errors.email?.message}>
        <Input
          id="forgot-email"
          type="email"
          autoComplete="email"
          inputMode="email"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          required
          placeholder="you@company.com"
          isInvalid={Boolean(errors.email)}
          {...form.register("email")}
        />
      </AuthField>
      <Button
        type="submit"
        className="h-11 w-full justify-center sm:h-9"
        loading={form.formState.isSubmitting}>
        {t("shell.auth.forgot_password.submit")}
      </Button>
    </form>
  );
};
