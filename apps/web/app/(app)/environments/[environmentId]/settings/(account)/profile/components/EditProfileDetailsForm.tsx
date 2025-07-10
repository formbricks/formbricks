"use client";

import { PasswordConfirmationModal } from "@/app/(app)/environments/[environmentId]/settings/(account)/profile/components/password-confirmation-modal";
import { appLanguages } from "@/lib/i18n/utils";
import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { useSignOut } from "@/modules/auth/hooks/use-sign-out";
import { Button } from "@/modules/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/modules/ui/components/dropdown-menu";
import { FormControl, FormError, FormField, FormItem, FormLabel } from "@/modules/ui/components/form";
import { Input } from "@/modules/ui/components/input";
import { Label } from "@/modules/ui/components/label";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslate } from "@tolgee/react";
import { ChevronDownIcon } from "lucide-react";
import { useState } from "react";
import { FormProvider, SubmitHandler, useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { z } from "zod";
import { TUser, TUserUpdateInput, ZUser, ZUserEmail } from "@formbricks/types/user";
import { resetPasswordAction, updateUserAction } from "../actions";

// Schema & types
const ZEditProfileNameFormSchema = ZUser.pick({ name: true, locale: true, email: true }).extend({
  email: ZUserEmail.transform((val) => val?.trim().toLowerCase()),
});
type TEditProfileNameForm = z.infer<typeof ZEditProfileNameFormSchema>;

interface IEditProfileDetailsFormProps {
  user: TUser;
  isPasswordResetEnabled?: boolean;
  emailVerificationDisabled: boolean;
}

export const EditProfileDetailsForm = ({
  user,
  isPasswordResetEnabled,
  emailVerificationDisabled,
}: IEditProfileDetailsFormProps) => {
  const { t } = useTranslate();

  const form = useForm<TEditProfileNameForm>({
    defaultValues: {
      name: user.name,
      locale: user.locale,
      email: user.email,
    },
    mode: "onChange",
    resolver: zodResolver(ZEditProfileNameFormSchema),
  });

  const { isSubmitting, isDirty } = form.formState;

  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const { signOut: signOutWithAudit } = useSignOut({ id: user.id, email: user.email });

  const handleConfirmPassword = async (password: string) => {
    const values = form.getValues();
    const dirtyFields = form.formState.dirtyFields;

    const emailChanged = "email" in dirtyFields;
    const nameChanged = "name" in dirtyFields;
    const localeChanged = "locale" in dirtyFields;

    const name = values.name.trim();
    const email = values.email.trim().toLowerCase();
    const locale = values.locale;

    const data: TUserUpdateInput = {};

    if (emailChanged) {
      data.email = email;
      data.password = password;
    }
    if (nameChanged) {
      data.name = name;
    }
    if (localeChanged) {
      data.locale = locale;
    }

    const updatedUserResult = await updateUserAction(data);

    if (updatedUserResult?.data) {
      if (!emailVerificationDisabled) {
        toast.success(t("auth.verification-requested.new_email_verification_success"));
      } else {
        toast.success(t("environments.settings.profile.email_change_initiated"));
        await signOutWithAudit({
          reason: "email_change",
          redirectUrl: "/email-change-without-verification-success",
          redirect: true,
          callbackUrl: "/email-change-without-verification-success",
          clearEnvironmentId: true,
        });
        return;
      }
    } else {
      const errorMessage = getFormattedErrorMessage(updatedUserResult);
      toast.error(errorMessage);
      return;
    }

    window.location.reload();
    setShowModal(false);
  };

  const onSubmit: SubmitHandler<TEditProfileNameForm> = async (data) => {
    if (data.email !== user.email) {
      setShowModal(true);
    } else {
      try {
        await updateUserAction({
          ...data,
          name: data.name.trim(),
        });
        toast.success(t("environments.settings.profile.profile_updated_successfully"));
        window.location.reload();
        form.reset(data);
      } catch (error: any) {
        toast.error(`${t("common.error")}: ${error.message}`);
      }
    }
  };

  const handleResetPassword = async () => {
    setIsResettingPassword(true);

    const result = await resetPasswordAction();
    if (result?.data) {
      toast.success(t("auth.forgot-password.email-sent.heading"));

      await signOutWithAudit({
        reason: "password_reset",
        redirectUrl: "/auth/login",
        redirect: true,
        callbackUrl: "/auth/login",
        clearEnvironmentId: true,
      });
    } else {
      const errorMessage = getFormattedErrorMessage(result);
      toast.error(errorMessage);
    }

    setIsResettingPassword(false);
  };

  return (
    <>
      <FormProvider {...form}>
        <form className="w-full max-w-sm" onSubmit={form.handleSubmit(onSubmit)}>
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
                    required
                    placeholder={t("common.full_name")}
                    isInvalid={!!form.formState.errors.name}
                  />
                </FormControl>
                <FormError />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem className="mt-4">
                <FormLabel>{t("common.email")}</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    type="email"
                    required
                    isInvalid={!!form.formState.errors.email}
                    disabled={user.identityProvider !== "email"}
                  />
                </FormControl>
                <FormError />
              </FormItem>
            )}
          />

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
                        variant="ghost"
                        className="h-10 w-full border border-slate-300 px-3 text-left">
                        <div className="flex w-full items-center justify-between">
                          {appLanguages.find((l) => l.code === field.value)?.label["en-US"] ?? "NA"}
                          <ChevronDownIcon className="h-4 w-4 text-slate-500" />
                        </div>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      className="min-w-[var(--radix-dropdown-menu-trigger-width)] bg-slate-50 text-slate-700"
                      align="start">
                      <DropdownMenuRadioGroup value={field.value} onValueChange={field.onChange}>
                        {appLanguages.map((lang) => (
                          <DropdownMenuRadioItem
                            key={lang.code}
                            value={lang.code}
                            className="min-h-8 cursor-pointer">
                            {lang.label["en-US"]}
                          </DropdownMenuRadioItem>
                        ))}
                      </DropdownMenuRadioGroup>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </FormControl>
                <FormError />
              </FormItem>
            )}
          />

          {isPasswordResetEnabled && (
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
                  disabled={isResettingPassword}
                  size="default"
                  variant="secondary">
                  {t("auth.forgot-password.reset_password")}
                </Button>
              </div>
            </div>
          )}

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

      <PasswordConfirmationModal
        open={showModal}
        setOpen={setShowModal}
        oldEmail={user.email}
        newEmail={form.getValues("email") || user.email}
        onConfirm={handleConfirmPassword}
      />
    </>
  );
};
