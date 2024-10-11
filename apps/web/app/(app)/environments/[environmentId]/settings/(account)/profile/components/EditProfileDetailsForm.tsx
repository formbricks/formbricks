"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { SubmitHandler, useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { z } from "zod";
import { appLanguages } from "@formbricks/lib/i18n/utils";
import { TUser, ZUser } from "@formbricks/types/user";
import { Button } from "@formbricks/ui/components/Button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@formbricks/ui/components/DropdownMenu";
import {
  FormControl,
  FormError,
  FormField,
  FormItem,
  FormLabel,
  FormProvider,
} from "@formbricks/ui/components/Form";
import { Input } from "@formbricks/ui/components/Input";
import { Label } from "@formbricks/ui/components/Label";
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
  const t = useTranslations();

  const onSubmit: SubmitHandler<TEditProfileNameForm> = async (data) => {
    try {
      const name = data.name.trim();
      const locale = data.locale;
      await updateUserAction({ name, locale });
      toast.success(t("common.profile_updated_successfully"));
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
                  placeholder="Full Name"
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
                      className="w-full border border-slate-300 px-2 text-left"
                      variant="minimal">
                      {appLanguages.find((language) => language.code === field.value)?.label || "NA"}
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
                        {language.label}
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
  );
};
