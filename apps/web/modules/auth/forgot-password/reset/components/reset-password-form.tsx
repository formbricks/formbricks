"use client";

import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { resetPasswordAction } from "@/modules/auth/forgot-password/reset/actions";
import { PasswordChecks } from "@/modules/auth/signup/components/password-checks";
import { Button } from "@/modules/ui/components/button";
import { FormField } from "@/modules/ui/components/form";
import { PasswordInput } from "@/modules/ui/components/password-input";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslate } from "@tolgee/react";
import { useRouter, useSearchParams } from "next/navigation";
import { SubmitHandler, useForm } from "react-hook-form";
import { toast } from "react-hot-toast";
import { z } from "zod";
import { ZUserPassword } from "@formbricks/types/user";

const ZPasswordResetForm = z.object({
  password: ZUserPassword,
  confirmPassword: ZUserPassword,
});

type TPasswordResetForm = z.infer<typeof ZPasswordResetForm>;

const passwordInputProps = {
  autoComplete: "current-password",
  placeholder: "*******",
  required: true,
  className:
    "focus:border-brand-dark focus:ring-brand-dark mt-2 block w-full rounded-md border-slate-300 shadow-sm sm:text-sm",
};

export const ResetPasswordForm = () => {
  const { t } = useTranslate();
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
      toast.error(errorMessage);
    }
  };

  return (
    <>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        <div className="space-y-4">
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-slate-800">
              {t("auth.forgot-password.reset.new_password")}
            </label>
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => <PasswordInput {...passwordInputProps} {...field} id="password" />}
            />
          </div>
          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-800">
              {t("auth.forgot-password.reset.confirm_password")}
            </label>
            <FormField
              control={form.control}
              name="confirmPassword"
              render={({ field }) => (
                <PasswordInput {...passwordInputProps} {...field} id="confirmPassword" />
              )}
            />
          </div>

          <PasswordChecks password={form.watch("password")} />
        </div>

        <div>
          <Button
            type="submit"
            disabled={!form.formState.isValid}
            className="w-full justify-center"
            loading={form.formState.isSubmitting}>
            {t("auth.forgot-password.reset_password")}
          </Button>
        </div>
      </form>
    </>
  );
};
