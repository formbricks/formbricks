"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormProvider, SubmitHandler, useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { forgotPasswordAction } from "@/modules/auth/forgot-password/actions";
import { Button } from "@/modules/ui/components/button";
import { FormControl, FormError, FormField, FormItem, FormLabel } from "@/modules/ui/components/form";
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

  return (
    <FormProvider {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem className="w-full text-left">
              <FormLabel>{t("common.email")}</FormLabel>
              <FormControl>
                <Input
                  name="email"
                  type="email"
                  value={field.value}
                  onBlur={field.onBlur}
                  onChange={(e) => field.onChange(e)}
                  autoComplete="email"
                  inputMode="email"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  required
                />
              </FormControl>
              <FormError role="alert" />
            </FormItem>
          )}
        />

        <div>
          <Button
            type="submit"
            className="h-11 w-full justify-center sm:h-9"
            loading={form.formState.isSubmitting}>
            {t("auth.forgot-password.reset_password")}
          </Button>
          <div className="mt-3 text-center">
            <Button variant="ghost" className="h-11 w-full justify-center sm:h-9" asChild>
              <Link href="/auth/login">{t("auth.forgot-password.back_to_login")}</Link>
            </Button>
          </div>
        </div>
      </form>
    </FormProvider>
  );
};
