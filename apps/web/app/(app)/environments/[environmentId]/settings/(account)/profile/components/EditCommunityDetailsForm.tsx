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
import { Textarea } from "@/modules/ui/components/textarea";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslate } from "@tolgee/react";
import { SubmitHandler, useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { z } from "zod";
import { TUser, ZUser } from "@formbricks/types/user";
import { updateUserAction } from "../actions";

const ZEditCommunityFormSchema = ZUser.pick({ communityName: true, communityDescription: true });

type TEditCommunityForm = z.infer<typeof ZEditCommunityFormSchema>;

export const EditCommunityForm = ({ user }: { user: TUser }) => {
  const form = useForm<TEditCommunityForm>({
    defaultValues: {
      communityName: user.communityName || "",
      communityDescription: user.communityDescription || "",
    },
    mode: "onChange",
    resolver: zodResolver(ZEditCommunityFormSchema),
  });

  const { isSubmitting, isDirty } = form.formState;
  const { t } = useTranslate();

  const onSubmit: SubmitHandler<TEditCommunityForm> = async (data) => {
    try {
      const communityName = data.communityName?.trim();
      const communityDescription = data.communityDescription?.trim();

      await updateUserAction({ communityName, communityDescription });
      toast.success(t("environments.settings.profile.profile_updated_successfully"));
      window.location.reload();
      form.reset({ communityName, communityDescription });
    } catch (error) {
      toast.error(`${t("common.error")}: ${error.message}`);
    }
  };

  return (
    <div className="flex flex-col space-y-2">
      <FormProvider {...form}>
        <form className="w-full max-w-sm space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
          <FormField
            control={form.control}
            name="communityName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("common.community_name")}</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    type="text"
                    placeholder={t("common.community_name")}
                    required
                    isInvalid={!!form.formState.errors.communityName}
                    value={field.value || ""}
                  />
                </FormControl>
                <FormError />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="communityDescription"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("common.community_description")}</FormLabel>
                <FormControl>
                  <Textarea
                    className={`min-h-24 ${form.formState.errors.communityDescription ? "border-red-500" : ""}`}
                    {...field}
                    placeholder={t("common.community_description")}
                    value={field.value || ""}
                  />
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
    </div>
  );
};
