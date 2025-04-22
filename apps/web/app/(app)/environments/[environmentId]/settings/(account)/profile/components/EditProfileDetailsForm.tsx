"use client";

import { appLanguages } from "@/lib/i18n/utils";
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
import { SubmitHandler, useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { z } from "zod";
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
