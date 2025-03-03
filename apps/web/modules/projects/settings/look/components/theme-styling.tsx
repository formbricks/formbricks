"use client";

import { previewSurvey } from "@/app/lib/templates";
import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { updateProjectAction } from "@/modules/projects/settings/actions";
import { FormStylingSettings } from "@/modules/survey/editor/components/form-styling-settings";
import { Alert, AlertDescription } from "@/modules/ui/components/alert";
import { AlertDialog } from "@/modules/ui/components/alert-dialog";
import { BackgroundStylingCard } from "@/modules/ui/components/background-styling-card";
import { Button } from "@/modules/ui/components/button";
import { CardStylingSettings } from "@/modules/ui/components/card-styling-settings";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormProvider,
} from "@/modules/ui/components/form";
import { Switch } from "@/modules/ui/components/switch";
import { ThemeStylingPreviewSurvey } from "@/modules/ui/components/theme-styling-preview-survey";
import { zodResolver } from "@hookform/resolvers/zod";
import { Project } from "@prisma/client";
import { useTranslate } from "@tolgee/react";
import { RotateCcwIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { SubmitHandler, UseFormReturn, useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { defaultStyling } from "@formbricks/lib/styling/constants";
import { TProjectStyling, ZProjectStyling } from "@formbricks/types/project";
import { TSurvey, TSurveyStyling, TSurveyType } from "@formbricks/types/surveys/types";

interface ThemeStylingProps {
  project: Project;
  environmentId: string;
  colors: string[];
  isUnsplashConfigured: boolean;
  isReadOnly: boolean;
}

export const ThemeStyling = ({
  project,
  environmentId,
  colors,
  isUnsplashConfigured,
  isReadOnly,
}: ThemeStylingProps) => {
  const { t } = useTranslate();
  const router = useRouter();

  const form = useForm<TProjectStyling>({
    defaultValues: { ...defaultStyling, ...project.styling },
    resolver: zodResolver(ZProjectStyling),
  });

  const [previewSurveyType, setPreviewSurveyType] = useState<TSurveyType>("link");
  const [confirmResetStylingModalOpen, setConfirmResetStylingModalOpen] = useState(false);

  const [formStylingOpen, setFormStylingOpen] = useState(false);
  const [cardStylingOpen, setCardStylingOpen] = useState(false);
  const [backgroundStylingOpen, setBackgroundStylingOpen] = useState(false);

  const onReset = useCallback(async () => {
    const updatedProjectResponse = await updateProjectAction({
      projectId: project.id,
      data: {
        styling: { ...defaultStyling },
      },
    });

    if (updatedProjectResponse?.data) {
      form.reset({ ...defaultStyling });
      toast.success(t("environments.project.look.styling_updated_successfully"));
      router.refresh();
    } else {
      const errorMessage = getFormattedErrorMessage(updatedProjectResponse);
      toast.error(errorMessage);
    }
  }, [form, project.id, router]);

  const onSubmit: SubmitHandler<TProjectStyling> = async (data) => {
    const updatedProjectResponse = await updateProjectAction({
      projectId: project.id,
      data: {
        styling: data,
      },
    });

    if (updatedProjectResponse?.data) {
      form.reset({ ...updatedProjectResponse.data.styling });
      toast.success(t("environments.project.look.styling_updated_successfully"));
    } else {
      const errorMessage = getFormattedErrorMessage(updatedProjectResponse);
      toast.error(errorMessage);
    }
  };

  if (isReadOnly) {
    return (
      <Alert variant="warning">
        <AlertDescription>
          {t("common.only_owners_managers_and_manage_access_members_can_perform_this_action")}
        </AlertDescription>
      </Alert>
    );
  }
  return (
    <FormProvider {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <div className="flex">
          {/* Styling settings */}
          <div className="relative flex w-1/2 flex-col pr-6">
            <div className="flex flex-1 flex-col gap-4">
              <div className="flex flex-col gap-4 rounded-lg bg-slate-50 p-4">
                <div className="flex items-center gap-6">
                  <FormField
                    control={form.control}
                    name="allowStyleOverwrite"
                    render={({ field }) => (
                      <FormItem className="flex w-full items-center gap-2 space-y-0">
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={(value) => {
                              field.onChange(value);
                            }}
                          />
                        </FormControl>

                        <div>
                          <FormLabel>{t("environments.project.look.enable_custom_styling")}</FormLabel>
                          <FormDescription>
                            {t("environments.project.look.enable_custom_styling_description")}
                          </FormDescription>
                        </div>
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-3 rounded-lg bg-slate-50 p-4">
                <FormStylingSettings
                  open={formStylingOpen}
                  setOpen={setFormStylingOpen}
                  isSettingsPage
                  form={form as UseFormReturn<TProjectStyling | TSurveyStyling>}
                />

                <CardStylingSettings
                  open={cardStylingOpen}
                  setOpen={setCardStylingOpen}
                  isSettingsPage
                  project={project}
                  surveyType={previewSurveyType}
                  form={form as UseFormReturn<TProjectStyling | TSurveyStyling>}
                />

                <BackgroundStylingCard
                  open={backgroundStylingOpen}
                  setOpen={setBackgroundStylingOpen}
                  environmentId={environmentId}
                  colors={colors}
                  isSettingsPage
                  isUnsplashConfigured={isUnsplashConfigured}
                  form={form as UseFormReturn<TProjectStyling | TSurveyStyling>}
                />
              </div>
            </div>

            <div className="mt-4 flex items-center gap-2">
              <Button size="sm" type="submit">
                {t("common.save")}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="flex items-center gap-2"
                onClick={() => setConfirmResetStylingModalOpen(true)}>
                {t("common.reset_to_default")}
                <RotateCcwIcon className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Survey Preview */}

          <div className="relative w-1/2 rounded-lg bg-slate-100 pt-4">
            <div className="sticky top-4 mb-4 h-[600px]">
              <ThemeStylingPreviewSurvey
                survey={previewSurvey(project.name, t) as TSurvey}
                project={{
                  ...project,
                  styling: form.watch(),
                }}
                previewType={previewSurveyType}
                setPreviewType={setPreviewSurveyType}
              />
            </div>
          </div>

          {/* Confirm reset styling modal */}
          <AlertDialog
            open={confirmResetStylingModalOpen}
            setOpen={setConfirmResetStylingModalOpen}
            headerText={t("environments.project.look.reset_styling")}
            mainText={t("environments.project.look.reset_styling_confirmation")}
            confirmBtnLabel={t("common.confirm")}
            onConfirm={() => {
              onReset();
              setConfirmResetStylingModalOpen(false);
            }}
            onDecline={() => setConfirmResetStylingModalOpen(false)}
          />
        </div>
      </form>
    </FormProvider>
  );
};
