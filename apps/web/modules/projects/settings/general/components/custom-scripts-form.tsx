"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangleIcon } from "lucide-react";
import { SubmitHandler, useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { TProject } from "@formbricks/types/project";
import { cn } from "@/lib/cn";
import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { Alert, AlertDescription } from "@/modules/ui/components/alert";
import { Button } from "@/modules/ui/components/button";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormProvider,
} from "@/modules/ui/components/form";
import { updateProjectAction } from "../../actions";

interface CustomScriptsFormProps {
  project: TProject;
  isReadOnly: boolean;
}

const ZCustomScriptsInput = z.object({
  customHeadScripts: z.string().nullish(),
});

type TCustomScriptsFormValues = z.infer<typeof ZCustomScriptsInput>;

export const CustomScriptsForm: React.FC<CustomScriptsFormProps> = ({ project, isReadOnly }) => {
  const { t } = useTranslation();
  const form = useForm<TCustomScriptsFormValues>({
    defaultValues: {
      customHeadScripts: project.customHeadScripts ?? "",
    },
    resolver: zodResolver(ZCustomScriptsInput),
    mode: "onChange",
  });

  const { isDirty, isSubmitting } = form.formState;

  const updateCustomScripts: SubmitHandler<TCustomScriptsFormValues> = async (data) => {
    try {
      const updatedProjectResponse = await updateProjectAction({
        projectId: project.id,
        data: {
          customHeadScripts: data.customHeadScripts || null,
        },
      });
      if (updatedProjectResponse?.data) {
        toast.success(t("environments.workspace.general.custom_scripts_updated_successfully"));
        form.reset({ customHeadScripts: updatedProjectResponse.data.customHeadScripts ?? "" });
      } else {
        const errorMessage = getFormattedErrorMessage(updatedProjectResponse);
        toast.error(errorMessage);
      }
    } catch {
      toast.error(t("common.something_went_wrong_please_try_again"));
    }
  };

  return (
    <>
      <FormProvider {...form}>
        <form className="flex w-full flex-col space-y-4" onSubmit={form.handleSubmit(updateCustomScripts)}>
          <Alert variant="warning" className="flex items-start gap-2">
            <AlertTriangleIcon className="mt-0.5 h-4 w-4 shrink-0" />
            <AlertDescription>{t("environments.workspace.general.custom_scripts_warning")}</AlertDescription>
          </Alert>

          <FormField
            control={form.control}
            name="customHeadScripts"
            render={({ field }) => (
              <FormItem>
                <FormLabel htmlFor="customHeadScripts">
                  {t("environments.workspace.general.custom_scripts_label")}
                </FormLabel>
                <FormDescription>
                  {t("environments.workspace.general.custom_scripts_description")}
                </FormDescription>
                <FormControl>
                  <textarea
                    id="customHeadScripts"
                    rows={8}
                    placeholder={t("environments.workspace.general.custom_scripts_placeholder")}
                    className={cn(
                      "focus:border-brand-dark flex w-full rounded-md border border-slate-300 bg-transparent px-3 py-2 font-mono text-xs text-slate-800 placeholder:text-slate-400 focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50",
                      isReadOnly && "bg-slate-50"
                    )}
                    {...field}
                    value={field.value ?? ""}
                    disabled={isReadOnly}
                  />
                </FormControl>
              </FormItem>
            )}
          />

          <Button
            type="submit"
            size="sm"
            className="w-fit"
            loading={isSubmitting}
            disabled={isSubmitting || !isDirty || isReadOnly}>
            {t("common.save")}
          </Button>
        </form>
      </FormProvider>
      {isReadOnly && (
        <Alert variant="warning" className="mt-4">
          <AlertDescription>
            {t("common.only_owners_managers_and_manage_access_members_can_perform_this_action")}
          </AlertDescription>
        </Alert>
      )}
    </>
  );
};
