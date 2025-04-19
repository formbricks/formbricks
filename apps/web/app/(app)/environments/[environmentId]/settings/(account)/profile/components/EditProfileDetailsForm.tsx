"use client";

import { formbricksLogout } from "@/app/lib/formbricks";
import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { forgotPasswordAction } from "@/modules/auth/forgot-password/actions";
import { Button } from "@/modules/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/modules/ui/components/dropdown-menu";
import {
  FormControl,
  FormError,
  FormField,
  FormItem,
  FormLabel,
  FormProvider,
} from "@/modules/ui/components/form";
import { Input } from "@/modules/ui/components/input";
import { Label } from "@/modules/ui/components/label";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslate } from "@tolgee/react";
import { ChevronDownIcon } from "lucide-react";
import { signOut } from "next-auth/react";
import { useState } from "react";
import { SubmitHandler, useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { z } from "zod";
import { appLanguages } from "@formbricks/lib/i18n/utils";
import { TUser, ZUser } from "@formbricks/types/user";
import { updateUserAction } from "../actions";

const ZEditProfileNameFormSchema = ZUser.pick({ name: true, locale: true });
type TEditProfileNameForm = z.infer<typeof ZEditProfileNameFormSchema>;

export const EditProfileDetailsForm = ({ user }: { user: TUser }) => {
  const form = useForm<TEditProfileNameForm>({
    defaultValues: { name: user.name, locale: user.locale || "en" },
    mode: "onChange",
    resolver: zodResolver(ZEditProfileNameFormSchema),
  });

  const { isSubmitting, isDirty } = form.formState;
  const { t } = useTranslate();
  const [isResettingPassword, setIsResettingPassword] = useState(false);

  const onSubmit: SubmitHandler<TEditProfileNameForm> = async (data) => {
    try {
      const name = data.name.trim();
      const locale = data.locale;
      await updateUserAction({ name, locale });
      toast.success(t("environments.settings.profile.profile_updated_successfully"));
      window.location.reload();
      form.reset({ name, locale });
    } catch (error) {
      toast.error(`${t("common.error")}: ${error.message}`);
    }
  };

  const handleResetPassword = async () => {
    if (!user.email) return;

    setIsResettingPassword(true);

    const resetPasswordResponse = await forgotPasswordAction({ email: user.email });

    if (!resetPasswordResponse?.data) {
      const errorMessage = getFormattedErrorMessage(resetPasswordResponse);
      toast.error(errorMessage);
    } else {
      toast.success(t("auth.forgot-password.email-sent.heading"));
      await signOut({ callbackUrl: "/auth/login" });
      await formbricksLogout();
    }

    setIsResettingPassword(false);
  };

  return (
    <FormProvider {...form}>
      <form className="w-full max-w-sm items-center" onSubmit={form.handleSubmit(onSubmit)}>
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("common.full_name")}</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  type="text"
                  placeholder={t("common.full_name")}
                  required
                  isInvalid={!!form.formState.errors.name}
                />
              </FormControl>
              <FormError />
            </FormItem>
          )}
        />

        <div className="mt-4 space-y-2">
          <Label htmlFor="email">{t("common.email")}</Label>
          <Input type="email" id="email" defaultValue={user.email} disabled />
        </div>

        <FormField
          control={form.control}
          name="locale"
          render={({ field }) => (
            <FormItem className="mt-4">
              <FormLabel>{t("common.language")}</FormLabel>
              <FormControl>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      className="h-10 w-full border border-slate-300 px-3 text-left"
                      variant="ghost">
                      <div className="flex w-full items-center justify-between">
                        {appLanguages.find((language) => language.code === field.value)?.label[field.value] ||
                          "NA"}
                        <ChevronDownIcon className="h-4 w-4 text-slate-500" />
                      </div>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    className="w-40 bg-slate-50 text-slate-700"
                    align="start"
                    side="bottom">
                    {appLanguages.map((language) => (
                      <DropdownMenuItem
                        key={language.code}
                        onClick={() => field.onChange(language.code)}
                        className="min-h-8 cursor-pointer">
                        {language.label[field.value]}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </FormControl>
              <FormError />
            </FormItem>
          )}
        />

        <div className="mt-4 space-y-2">
          <Label htmlFor="reset-password">{t("auth.forgot-password.reset_password")}</Label>
          <p className="mt-1 text-sm text-slate-500">
            {t("auth.forgot-password.reset_password_description")}
          </p>
          <div className="flex items-center justify-between gap-2">
            <Input type="email" id="reset-password" defaultValue={user.email} disabled />
            <Button
              onClick={handleResetPassword}
              loading={isResettingPassword}
              disabled={isResettingPassword || !user.email}
              size="default"
              variant="secondary">
              {t("auth.forgot-password.reset_password")}
            </Button>
          </div>
        </div>

        <Button
          type="submit"
          className="mt-4"
          size="sm"
          loading={isSubmitting}
          disabled={isSubmitting || !isDirty}>
          {t("common.update")}
        </Button>
      </form>
    </FormProvider>
  );
};
