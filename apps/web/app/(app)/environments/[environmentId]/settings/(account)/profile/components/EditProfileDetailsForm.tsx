"use client";

import { appLanguages } from "@/lib/i18n/utils";
import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { Button } from "@/modules/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/modules/ui/components/dropdown-menu";
import { FormControl, FormError, FormField, FormItem, FormLabel } from "@/modules/ui/components/form";
import { Input } from "@/modules/ui/components/input";
import { PasswordConfirmationModal } from "@/modules/ui/components/password-confirmation-modal";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslate } from "@tolgee/react";
import { ChevronDownIcon } from "lucide-react";
import { signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { FormProvider, SubmitHandler, useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { z } from "zod";
import { TUser, ZUser } from "@formbricks/types/user";
import { comparePasswordsAction, sendVerificationNewEmailAction, updateUserAction } from "../actions";

// Schema & types
const ZEditProfileNameFormSchema = ZUser.pick({ name: true, locale: true, email: true });
type TEditProfileNameForm = z.infer<typeof ZEditProfileNameFormSchema>;

export const EditProfileDetailsForm = ({
  user,
  emailVerificationDisabled,
}: {
  user: TUser;
  emailVerificationDisabled: boolean;
}) => {
  const { t } = useTranslate();
  const router = useRouter();

  const form = useForm<TEditProfileNameForm>({
    defaultValues: {
      name: user.name,
      locale: user.locale || "en",
      email: user.email,
    },
    mode: "onChange",
    resolver: zodResolver(ZEditProfileNameFormSchema),
  });

  const { isSubmitting, isDirty } = form.formState;
  const [showModal, setShowModal] = useState(false);

  function getChangedFields(user: TUser, formValues: TEditProfileNameForm) {
    const changedFields: Partial<TEditProfileNameForm> = {};

    if (user.name !== formValues.name) changedFields.name = formValues.name;
    if (user.locale !== formValues.locale) changedFields.locale = formValues.locale;
    if (user.email !== formValues.email) changedFields.email = formValues.email;

    return changedFields;
  }

  const handleConfirmPassword = async (password: string) => {
    try {
      const values = form.getValues();
      const changedFields = getChangedFields(user, values);

      const emailChanged = !!changedFields.email;
      const nameOrLocaleChanged = changedFields.name || changedFields.locale;

      if (emailChanged) {
        const passwordCheckResult = await comparePasswordsAction({ password });

        if (!passwordCheckResult?.data?.success) {
          toast.error("Invalid password");
          return;
        }
        if (!emailVerificationDisabled) {
          if (nameOrLocaleChanged) {
            await updateUserAction({
              name: changedFields.name?.trim() ?? user.name,
              locale: changedFields.locale ?? user.locale,
            });
          }
          const response = await sendVerificationNewEmailAction({ email: values.email });
          if (response?.data) {
            toast.success(t("auth.verification-requested.verification_email_successfully_sent"));
          } else {
            toast.error(getFormattedErrorMessage(response));
          }
        } else {
          await updateUserAction({
            name: changedFields.name?.trim() ?? user.name,
            email: changedFields.email ?? user.email,
            locale: changedFields.locale ?? user.locale,
          });
          toast.success(t("environments.settings.profile.profile_updated_successfully"));
          await signOut({ redirect: false });
          router.push(`/email-change-without-verification-success`);
          return;
        }
      } else if (nameOrLocaleChanged) {
        await updateUserAction({
          name: changedFields.name?.trim() ?? user.name,
          locale: changedFields.locale ?? user.locale,
        });
        toast.success(t("environments.settings.profile.profile_updated_successfully"));
      }

      window.location.reload();
      setShowModal(false);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      toast.error(`${t("common.error")}: ${errorMessage}`);
    }
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
                          {appLanguages.find((l) => l.code === field.value)?.label[field.value] || "NA"}
                          <ChevronDownIcon className="h-4 w-4 text-slate-500" />
                        </div>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-40 bg-slate-50 text-slate-700" align="start">
                      {appLanguages.map((lang) => (
                        <DropdownMenuItem
                          key={lang.code}
                          onClick={() => field.onChange(lang.code)}
                          className="min-h-8 cursor-pointer">
                          {lang.label[field.value]}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </FormControl>
                <FormError />
              </FormItem>
            )}
          />

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
