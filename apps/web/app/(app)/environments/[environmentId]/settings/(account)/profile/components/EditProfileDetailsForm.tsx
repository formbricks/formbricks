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
import { signIn, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { FormProvider, SubmitHandler, useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { z } from "zod";
import { TUser, ZUser } from "@formbricks/types/user";
import { sendVerificationNewEmailAction, updateUserAction } from "../actions";

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
  const [pendingData, setPendingData] = useState<TEditProfileNameForm | null>(null);

  const handleConfirmPassword = async (password: string) => {
    if (!pendingData) return;

    try {
      if (pendingData.email !== user.email) {
        const signInResponse = await signIn("credentials", {
          email: user.email,
          password,
          redirect: false,
        });
        console.log("password", password);
        console.log("email", user.email);
        console.log("****", signInResponse);

        if (!signInResponse || signInResponse.error) {
          toast.error("Invalid password");
          return;
        }

        if (!emailVerificationDisabled) {
          await updateUserAction({ name: pendingData.name, locale: pendingData.locale });
          const response = await sendVerificationNewEmailAction({ email: pendingData.email });
          if (response?.data) {
            toast.success(t("auth.verification-requested.verification_email_successfully_sent"));
          } else {
            toast.error(getFormattedErrorMessage(response));
          }
        } else {
          toast.success(t("environments.settings.profile.profile_updated_successfully"));
          await signOut({ redirect: false });
          const url = `/email-change-without-verification-success`;
          router.push(url);
          return;
        }
      } else {
        await updateUserAction({ ...pendingData });
        toast.success(t("environments.settings.profile.profile_updated_successfully"));
      }

      window.location.reload();
      setShowModal(false);
    } catch (error: any) {
      toast.error(`${t("common.error")}: ${error.message}`);
    }
  };

  const onSubmit: SubmitHandler<TEditProfileNameForm> = async (data) => {
    if (data.email !== user.email) {
      setPendingData(data);
      setShowModal(true);
    } else {
      try {
        await updateUserAction({ ...data });
        toast.success(t("environments.settings.profile.profile_updated_successfully"));
        ``;
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
                  <Input {...field} type="email" required isInvalid={!!form.formState.errors.email} />
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
        newEmail={pendingData?.email || user.email}
        onConfirm={handleConfirmPassword}
      />
    </>
  );
};
