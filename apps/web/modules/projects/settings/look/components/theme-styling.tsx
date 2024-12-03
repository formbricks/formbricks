"use client";

import { BackgroundStylingCard } from "@/app/(app)/(survey-editor)/environments/[environmentId]/surveys/[surveyId]/edit/components/BackgroundStylingCard";
import { CardStylingSettings } from "@/app/(app)/(survey-editor)/environments/[environmentId]/surveys/[surveyId]/edit/components/CardStylingSettings";
import { FormStylingSettings } from "@/app/(app)/(survey-editor)/environments/[environmentId]/surveys/[surveyId]/edit/components/FormStylingSettings";
import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { updateProjectAction } from "@/modules/projects/settings/actions";
import { ThemeStylingPreviewSurvey } from "@/modules/projects/settings/look/components/theme-styling-preview-survey";
import { Alert, AlertDescription } from "@/modules/ui/components/alert";
import { AlertDialog } from "@/modules/ui/components/alert-dialog";
import { Button } from "@/modules/ui/components/button";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormProvider,
} from "@/modules/ui/components/form";
import { Switch } from "@/modules/ui/components/switch";
import { zodResolver } from "@hookform/resolvers/zod";
import { RotateCcwIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { SubmitHandler, UseFormReturn, useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { COLOR_DEFAULTS, getPreviewSurvey } from "@formbricks/lib/styling/constants";
import { TProject, TProjectStyling, ZProjectStyling } from "@formbricks/types/project";
import { TSurvey, TSurveyStyling, TSurveyType } from "@formbricks/types/surveys/types";

interface ThemeStylingProps {
  project: TProject;
  environmentId: string;
  colors: string[];
  isUnsplashConfigured: boolean;
  locale: string;
  isReadOnly: boolean;
}

export const ThemeStyling = ({
  project,
  environmentId,
  colors,
  isUnsplashConfigured,
  locale,
  isReadOnly,
}: ThemeStylingProps) => {
  const t = useTranslations();
  const router = useRouter();

  const form = useForm<TProjectStyling>({
    defaultValues: {
      ...project.styling,

      // specify the default values for the colors
      allowStyleOverwrite: project.styling.allowStyleOverwrite ?? true,
      brandColor: { light: project.styling.brandColor?.light ?? COLOR_DEFAULTS.brandColor },
      questionColor: { light: project.styling.questionColor?.light ?? COLOR_DEFAULTS.questionColor },
      inputColor: { light: project.styling.inputColor?.light ?? COLOR_DEFAULTS.inputColor },
      inputBorderColor: { light: project.styling.inputBorderColor?.light ?? COLOR_DEFAULTS.inputBorderColor },
      cardBackgroundColor: {
        light: project.styling.cardBackgroundColor?.light ?? COLOR_DEFAULTS.cardBackgroundColor,
      },
      cardBorderColor: { light: project.styling.cardBorderColor?.light ?? COLOR_DEFAULTS.cardBorderColor },
      cardShadowColor: { light: project.styling.cardShadowColor?.light ?? COLOR_DEFAULTS.cardShadowColor },
      highlightBorderColor: project.styling.highlightBorderColor?.light
        ? {
            light: project.styling.highlightBorderColor.light,
          }
        : undefined,
      isDarkModeEnabled: project.styling.isDarkModeEnabled ?? false,
      roundness: project.styling.roundness ?? 8,
      cardArrangement: project.styling.cardArrangement ?? {
        linkSurveys: "straight",
        appSurveys: "straight",
      },
      background: project.styling.background,
      hideProgressBar: project.styling.hideProgressBar ?? false,
      isLogoHidden: project.styling.isLogoHidden ?? false,
    },
    resolver: zodResolver(ZProjectStyling),
  });

  const [previewSurveyType, setPreviewSurveyType] = useState<TSurveyType>("link");
  const [confirmResetStylingModalOpen, setConfirmResetStylingModalOpen] = useState(false);

  const [formStylingOpen, setFormStylingOpen] = useState(false);
  const [cardStylingOpen, setCardStylingOpen] = useState(false);
  const [backgroundStylingOpen, setBackgroundStylingOpen] = useState(false);

  const onReset = useCallback(async () => {
    const defaultStyling: TProjectStyling = {
      allowStyleOverwrite: true,
      brandColor: {
        light: COLOR_DEFAULTS.brandColor,
      },
      questionColor: {
        light: COLOR_DEFAULTS.questionColor,
      },
      inputColor: {
        light: COLOR_DEFAULTS.inputColor,
      },
      inputBorderColor: {
        light: COLOR_DEFAULTS.inputBorderColor,
      },
      cardBackgroundColor: {
        light: COLOR_DEFAULTS.cardBackgroundColor,
      },
      cardBorderColor: {
        light: COLOR_DEFAULTS.cardBorderColor,
      },
      isLogoHidden: false,
      highlightBorderColor: undefined,
      isDarkModeEnabled: false,
      background: {
        bg: "#fff",
        bgType: "color",
      },
      roundness: 8,
      cardArrangement: {
        linkSurveys: "straight",
        appSurveys: "straight",
      },
    };

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
                  key={form.watch("background.bg")}
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
                variant="minimal"
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
                survey={getPreviewSurvey(locale) as TSurvey}
                project={{
                  ...project,
                  styling: form.getValues(),
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
