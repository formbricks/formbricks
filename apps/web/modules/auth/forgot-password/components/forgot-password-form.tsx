"use client";

import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { forgotPasswordAction } from "@/modules/auth/forgot-password/actions";
import { Button } from "@/modules/ui/components/button";
import { FormControl, FormError, FormField, FormItem } from "@/modules/ui/components/form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslate } from "@tolgee/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormProvider, SubmitHandler, useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { z } from "zod";

const ZForgotPasswordForm = z.object({
  email: z.string().email(),
});

type TForgotPasswordForm = z.infer<typeof ZForgotPasswordForm>;

export const ForgotPasswordForm = () => {
  const router = useRouter();
  const { t } = useTranslate();
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

  return (
    <FormProvider {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-slate-800">
            {t("common.email")}
          </label>
          <div className="mt-1">
            <FormField
              control={form.control}
              name="email"
              render={({ field, fieldState: { error } }) => (
                <FormItem className="w-full">
                  <FormControl>
                    <input
                      id="email"
                      name="email"
                      type="email"
                      value={field.value}
                      onChange={(e) => field.onChange(e)}
                      autoComplete="email"
                      required
                      className="focus:border-brand-dark focus:ring-brand-dark block w-full rounded-md border-slate-300 shadow-xs sm:text-sm"
                    />
                  </FormControl>
                  {error?.message && <FormError className="text-left">{error.message}</FormError>}
                </FormItem>
              )}
            />
          </div>
        </div>

        <div>
          <Button type="submit" className="w-full justify-center" loading={form.formState.isSubmitting}>
            {t("auth.forgot-password.reset_password")}
          </Button>
          <div className="mt-3 text-center">
            <Button variant="ghost" className="w-full justify-center" asChild>
              <Link href="/auth/login">{t("auth.forgot-password.back_to_login")}</Link>
            </Button>
          </div>
        </div>
      </form>
    </FormProvider>
  );
};
