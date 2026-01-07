"use client";

import { AlertTriangleIcon } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { TSurvey } from "@formbricks/types/surveys/types";
import { useSurvey } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/context/survey-context";
import { cn } from "@/lib/cn";
import { updateSurveyAction } from "@/modules/survey/editor/actions";
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
import { TabToggle } from "@/modules/ui/components/tab-toggle";

interface CustomHtmlTabProps {
  projectCustomScripts: string | null | undefined;
  isReadOnly: boolean;
}

interface CustomHtmlFormData {
  customHeadScripts: string;
  customHeadScriptsMode: TSurvey["customHeadScriptsMode"];
}

export const CustomHtmlTab = ({ projectCustomScripts, isReadOnly }: CustomHtmlTabProps) => {
  const { t } = useTranslation();
  const { survey } = useSurvey();
  const [isSaving, setIsSaving] = useState(false);

  const form = useForm<CustomHtmlFormData>({
    defaultValues: {
      customHeadScripts: survey.customHeadScripts ?? "",
      customHeadScriptsMode: survey.customHeadScriptsMode ?? "add",
    },
  });

  const {
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { isDirty },
  } = form;

  const scriptsMode = watch("customHeadScriptsMode");

  const onSubmit = async (data: CustomHtmlFormData) => {
    if (isSaving || isReadOnly) return;

    setIsSaving(true);

    const updatedSurvey: TSurvey = {
      ...survey,
      customHeadScripts: data.customHeadScripts || null,
      customHeadScriptsMode: data.customHeadScriptsMode,
    };

    const result = await updateSurveyAction(updatedSurvey);

    if (result?.data) {
      toast.success(t("environments.surveys.share.custom_html.saved_successfully"));
      reset(data);
    } else {
      toast.error(t("common.something_went_wrong_please_try_again"));
    }

    setIsSaving(false);
  };

  return (
    <div className="px-1">
      <FormProvider {...form}>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Mode Toggle */}
          <div className="space-y-2">
            <FormLabel>{t("environments.surveys.share.custom_html.script_mode")}</FormLabel>
            <TabToggle
              id="custom-scripts-mode"
              options={[
                { value: "add", label: t("environments.surveys.share.custom_html.add_to_workspace") },
                { value: "replace", label: t("environments.surveys.share.custom_html.replace_workspace") },
              ]}
              defaultSelected={scriptsMode ?? "add"}
              onChange={(value) => setValue("customHeadScriptsMode", value, { shouldDirty: true })}
              disabled={isReadOnly}
            />
            <p className="text-sm text-slate-500">
              {scriptsMode === "add"
                ? t("environments.surveys.share.custom_html.add_mode_description")
                : t("environments.surveys.share.custom_html.replace_mode_description")}
            </p>
          </div>

          {/* Workspace Scripts Preview */}
          {projectCustomScripts && (
            <div className={scriptsMode === "replace" ? "opacity-50" : ""}>
              <FormLabel>{t("environments.surveys.share.custom_html.workspace_scripts_label")}</FormLabel>
              <div className="mt-2 max-h-32 overflow-auto rounded-md border border-slate-200 bg-slate-50 p-3">
                <pre className="font-mono text-xs whitespace-pre-wrap text-slate-600">
                  {projectCustomScripts}
                </pre>
              </div>
            </div>
          )}

          {!projectCustomScripts && (
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
              <p className="text-sm text-slate-500">
                {t("environments.surveys.share.custom_html.no_workspace_scripts")}
              </p>
            </div>
          )}

          {/* Survey Scripts */}
          <FormField
            control={form.control}
            name="customHeadScripts"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("environments.surveys.share.custom_html.survey_scripts_label")}</FormLabel>
                <FormDescription>
                  {t("environments.surveys.share.custom_html.survey_scripts_description")}
                </FormDescription>
                <FormControl>
                  <textarea
                    rows={8}
                    placeholder={t("environments.surveys.share.custom_html.placeholder")}
                    className={cn(
                      "focus:border-brand-dark flex w-full rounded-md border border-slate-300 bg-white px-3 py-2 font-mono text-xs text-slate-800 placeholder:text-slate-400 focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                    )}
                    {...field}
                    disabled={isReadOnly}
                  />
                </FormControl>
              </FormItem>
            )}
          />

          {/* Save Button */}
          <Button type="submit" disabled={isSaving || isReadOnly || !isDirty}>
            {isSaving ? t("common.saving") : t("common.save")}
          </Button>
          {/* Security Warning */}
          <Alert variant="warning" className="flex items-start gap-2">
            <AlertTriangleIcon className="mt-0.5 h-4 w-4 shrink-0" />
            <AlertDescription>
              {t("environments.surveys.share.custom_html.security_warning")}
            </AlertDescription>
          </Alert>
        </form>
      </FormProvider>
    </div>
  );
};
