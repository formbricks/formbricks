"use client";

import { Button } from "@/modules/ui/components/button";
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
import { SubmitHandler, useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { z } from "zod";
import { TUser, ZUser } from "@formbricks/types/user";
import { updateUserAction } from "../actions";

const ZEditProfileNameFormSchema = ZUser.pick({ name: true, locale: true });
type TEditProfileNameForm = z.infer<typeof ZEditProfileNameFormSchema>;

//TODO: action to get communityName, communityDescription,
//TODO: Form UI to edit communityName, communityDescription,
export const EditCommunityForm = ({ user }: { user: TUser }) => {
  const form = useForm<TEditProfileNameForm>({
    defaultValues: { name: user.name, locale: user.locale || "en" },
    mode: "onChange",
    resolver: zodResolver(ZEditProfileNameFormSchema),
  });

  const { isSubmitting, isDirty } = form.formState;
  const { t } = useTranslate();

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

        {/* disabled email field */}
        <div className="mt-4 space-y-2">
          <Label htmlFor="email">{t("common.email")}</Label>
          <Input type="email" id="email" defaultValue={user.email} disabled />
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
