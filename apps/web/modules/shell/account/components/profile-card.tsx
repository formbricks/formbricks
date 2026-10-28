"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Controller, SubmitHandler, useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { TUser, ZUser, ZUserEmail } from "@formbricks/types/user";
import { appLanguages, sortedAppLanguages } from "@/lib/i18n/utils";
import { getFormattedErrorMessage } from "@/lib/utils/error-message";
import { AuthField } from "@/modules/auth/components/auth-field";
import { useSignOut } from "@/modules/auth/hooks/use-sign-out";
import { Button } from "@/modules/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/modules/ui/components/card";
import { Input } from "@/modules/ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/modules/ui/components/select";
import { updateUserAction } from "../lib/actions";
import { buildProfileUpdate, requiresPasswordConfirmation } from "../lib/build-profile-update";
import { EmailChangeDialog } from "./email-change-dialog";

const ZProfileForm = ZUser.pick({ name: true, locale: true, email: true }).extend({
  email: ZUserEmail.transform((val) => val?.trim().toLowerCase()),
});
type TProfileForm = z.infer<typeof ZProfileForm>;

interface ProfileCardProps {
  user: TUser;
  emailVerificationDisabled: boolean;
}

const languageLabel = (code: string): string => {
  const language = appLanguages.find((candidate) => candidate.code === code);
  if (!language) return code;
  const { native, "en-US": english } = language.label;
  return native === english ? english : `${english} (${native})`;
};

// `readOnly`, not `disabled`: react-hook-form drops a disabled input's value from the form state.
const readOnlyClassName = (readOnly: boolean) => (readOnly ? "bg-slate-50 text-slate-500" : undefined);

/** Name, email and language. An SSO user's name and email belong to the identity provider. */
export const ProfileCard = ({ user, emailVerificationDisabled }: Readonly<ProfileCardProps>) => {
  const { t } = useTranslation();
  const router = useRouter();
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const { signOut } = useSignOut({ id: user.id, email: user.email });
  const isCredentialUser = user.identityProvider === "email";

  const form = useForm<TProfileForm>({
    defaultValues: { name: user.name, locale: user.locale, email: user.email },
    mode: "onChange",
    resolver: zodResolver(ZProfileForm),
  });
  const { errors, isDirty, isSubmitting } = form.formState;

  const saveProfile = async (password?: string): Promise<boolean> => {
    const update = buildProfileUpdate({
      values: form.getValues(),
      dirty: form.formState.dirtyFields,
      password,
    });
    const result = await updateUserAction(update);

    if (!result?.data) {
      toast.error(getFormattedErrorMessage(result ?? {}));
      return false;
    }

    return true;
  };

  const onSubmit: SubmitHandler<TProfileForm> = async () => {
    if (requiresPasswordConfirmation(form.formState.dirtyFields)) {
      setShowEmailDialog(true);
      return;
    }

    if (!(await saveProfile())) return;

    toast.success(t("workspace.settings.profile.profile_updated_successfully"));
    // A new language only applies on the next full load; anything else just needs fresh server data.
    if (form.formState.dirtyFields.locale) {
      globalThis.location.reload();
      return;
    }
    form.reset(form.getValues());
    router.refresh();
  };

  const confirmEmailChange = async (password: string) => {
    if (!(await saveProfile(password))) return;

    if (emailVerificationDisabled) {
      toast.success(t("workspace.settings.profile.email_change_initiated"));
      await signOut({
        reason: "email_change",
        redirectUrl: "/email-change-without-verification-success",
        redirect: true,
        callbackUrl: "/email-change-without-verification-success",
        clearWorkspaceId: true,
      });
      return;
    }

    toast.success(t("auth.verification-requested.new_email_verification_success"));
    globalThis.location.reload();
  };

  return (
    <Card>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <CardHeader>
          <CardTitle className="text-base">{t("common.profile")}</CardTitle>
          <CardDescription>{t("shell.account.profile.description")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid gap-4 md:grid-cols-2">
            <AuthField id="account-name" label={t("common.full_name")} error={errors.name?.message}>
              <Input
                id="account-name"
                autoComplete="name"
                required
                // The identity provider owns an SSO user's name: it is re-read on every sign-in
                // (`overrideUserInfo` in modules/ee/sso/lib/better-auth-providers.ts), so an edit here
                // would be silently reverted at their next login.
                readOnly={!isCredentialUser}
                className={readOnlyClassName(!isCredentialUser)}
                isInvalid={Boolean(errors.name)}
                {...form.register("name")}
              />
            </AuthField>
            <AuthField
              id="account-email"
              label={t("common.email")}
              hint={isCredentialUser ? t("shell.account.profile.email_hint") : undefined}
              error={errors.email?.message}>
              <Input
                id="account-email"
                type="email"
                autoComplete="email"
                required
                readOnly={!isCredentialUser}
                className={readOnlyClassName(!isCredentialUser)}
                isInvalid={Boolean(errors.email)}
                aria-describedby={isCredentialUser ? "account-email-hint" : undefined}
                {...form.register("email")}
              />
            </AuthField>
          </div>
          <AuthField id="account-language" label={t("common.language")} className="md:max-w-80">
            <Controller
              control={form.control}
              name="locale"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="account-language">
                    <SelectValue placeholder={t("common.select_language")}>
                      {languageLabel(field.value)}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {sortedAppLanguages.map((language) => (
                      <SelectItem key={language.code} value={language.code}>
                        {languageLabel(language.code)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </AuthField>
        </CardContent>
        <CardFooter>
          <Button type="submit" loading={isSubmitting} disabled={isSubmitting || !isDirty}>
            {t("common.save_changes")}
          </Button>
        </CardFooter>
      </form>

      <EmailChangeDialog
        open={showEmailDialog}
        setOpen={setShowEmailDialog}
        oldEmail={user.email}
        newEmail={form.getValues("email") || user.email}
        onConfirm={confirmEmailChange}
      />
    </Card>
  );
};
