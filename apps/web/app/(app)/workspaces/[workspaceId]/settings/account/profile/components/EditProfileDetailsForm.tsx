"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ChevronDownIcon } from "lucide-react";
import { useState } from "react";
import { FormProvider, SubmitHandler, useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { TUser, ZUser, ZUserEmail } from "@formbricks/types/user";
import { PasswordConfirmationModal } from "@/app/(app)/workspaces/[workspaceId]/settings/account/profile/components/password-confirmation-modal";
import type { TProfilePatchBody } from "@/app/api/internal/users/me/schemas";
import { appLanguages, sortedAppLanguages } from "@/lib/i18n/utils";
import { requestPasswordReset, updateProfile } from "@/modules/account/lib/api-client";
import { getV3ApiErrorMessage } from "@/modules/api/lib/v3-client";
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
  const { t } = useTranslation();

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

    const data: TProfilePatchBody = {};

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

    try {
      await updateProfile(data);
    } catch (error) {
      toast.error(getV3ApiErrorMessage(error, t("common.something_went_wrong_please_try_again")));
      return;
    }

    if (!emailVerificationDisabled) {
      toast.success(t("auth.verification-requested.new_email_verification_success"));
    } else {
      toast.success(t("workspace.settings.profile.email_change_initiated"));
      await signOutWithAudit({
        reason: "email_change",
        redirectUrl: "/email-change-without-verification-success",
        redirect: true,
        callbackUrl: "/email-change-without-verification-success",
        clearWorkspaceId: true,
      });
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
        await updateProfile({ ...data, name: data.name.trim() });
        toast.success(t("workspace.settings.profile.profile_updated_successfully"));
        window.location.reload();
        form.reset(data);
      } catch (error) {
        toast.error(getV3ApiErrorMessage(error, t("common.something_went_wrong_please_try_again")));
      }
    }
  };

  const handleResetPassword = async () => {
    setIsResettingPassword(true);

    try {
      await requestPasswordReset();
      toast.success(t("auth.forgot-password.email-sent.heading"));

      await signOutWithAudit({
        reason: "password_reset",
        redirectUrl: "/auth/login",
        redirect: true,
        callbackUrl: "/auth/login",
        clearWorkspaceId: true,
      });
    } catch (error) {
      toast.error(getV3ApiErrorMessage(error, t("common.something_went_wrong_please_try_again")));
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
                    // The identity provider owns an SSO user's name: it is re-read on every sign-in
                    // (`overrideUserInfo` in modules/ee/sso/lib/better-auth-providers.ts), so an edit
                    // here would be silently reverted at their next login. Same treatment, and the
                    // same condition, as the email field below.
                    disabled={user.identityProvider !== "email"}
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
            render={({ field }) => {
              const selectedLanguage = appLanguages.find((l) => l.code === field.value);

              return (
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
                            {selectedLanguage ? (
                              <>
                                {selectedLanguage.label["en-US"]}
                                {selectedLanguage.label.native !== selectedLanguage.label["en-US"] &&
                                  ` (${selectedLanguage.label.native})`}
                              </>
                            ) : (
                              t("common.select")
                            )}
                            <ChevronDownIcon className="size-4 text-slate-500" />
                          </div>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        className="min-w-(--radix-dropdown-menu-trigger-width) bg-white text-slate-700"
                        align="start">
                        <DropdownMenuRadioGroup value={field.value} onValueChange={field.onChange}>
                          {sortedAppLanguages.map((lang) => (
                            <DropdownMenuRadioItem
                              key={lang.code}
                              value={lang.code}
                              className="min-h-8 cursor-pointer">
                              {lang.label["en-US"]}
                              {lang.label.native !== lang.label["en-US"] && ` (${lang.label.native})`}
                            </DropdownMenuRadioItem>
                          ))}
                        </DropdownMenuRadioGroup>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </FormControl>
                  <FormError />
                </FormItem>
              );
            }}
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
