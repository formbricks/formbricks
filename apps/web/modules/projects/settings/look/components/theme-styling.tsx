"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Project } from "@prisma/client";
import { RotateCcwIcon, SparklesIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { SubmitHandler, UseFormReturn, useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { TProjectStyling, ZProjectStyling } from "@formbricks/types/project";
import { TSurveyStyling, TSurveyType } from "@formbricks/types/surveys/types";
import { previewSurvey } from "@/app/lib/templates";
import { COLOR_DEFAULTS, defaultStyling } from "@/lib/styling/constants";
import { isLight, mixColor } from "@/lib/utils/colors";
import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { updateProjectAction } from "@/modules/projects/settings/actions";
import { FormStylingSettings } from "@/modules/survey/editor/components/form-styling-settings";
import { Alert, AlertDescription } from "@/modules/ui/components/alert";
import { AlertDialog } from "@/modules/ui/components/alert-dialog";
import { BackgroundStylingCard } from "@/modules/ui/components/background-styling-card";
import { Button } from "@/modules/ui/components/button";
import { CardStylingSettings } from "@/modules/ui/components/card-styling-settings";
import { ColorPicker } from "@/modules/ui/components/color-picker";
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

interface ThemeStylingProps {
  project: Project;
  environmentId: string;
  colors: string[];
  isUnsplashConfigured: boolean;
  isReadOnly: boolean;
  isStorageConfigured: boolean;
  publicDomain: string;
}

export const ThemeStyling = ({
  project,
  environmentId,
  colors,
  isUnsplashConfigured,
  isReadOnly,
  isStorageConfigured = true,
  publicDomain,
}: ThemeStylingProps) => {
  const { t } = useTranslation();
  const router = useRouter();

  const form = useForm<TProjectStyling>({
    defaultValues: { ...defaultStyling, ...project.styling },
    resolver: zodResolver(ZProjectStyling),
  });

  const [previewSurveyType, setPreviewSurveyType] = useState<TSurveyType>("link");
  const [confirmResetStylingModalOpen, setConfirmResetStylingModalOpen] = useState(false);
  const [confirmSuggestColorsOpen, setConfirmSuggestColorsOpen] = useState(false);

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
      toast.success(t("environments.workspace.look.styling_updated_successfully"));
      router.refresh();
    } else {
      const errorMessage = getFormattedErrorMessage(updatedProjectResponse);
      toast.error(errorMessage);
    }
  }, [form, project.id, router, t]);

  const handleSuggestColors = () => {
    const brandColor = form.getValues().brandColor?.light ?? COLOR_DEFAULTS.brandColor;

    // Derive everything from Brand Color
    const derivedInputBg = mixColor(brandColor, "#ffffff", 0.97) ?? "#ffffff";
    const derivedDarkTextColor = mixColor(brandColor, "#0f172a", 0.9) ?? "#0f172a";
    const derivedCardBg = mixColor(brandColor, "#ffffff", 0.96) ?? "#ffffff";
    const derivedCardBorder = mixColor(brandColor, "#ffffff", 0.9) ?? "#f8fafc";
    const derivedPageBg = mixColor(brandColor, "#ffffff", 0.95) ?? "#f8fafc";

    const isBrandLight = isLight(brandColor);

    // Accent derived from Brand (Monochromatic)
    const accentColor = brandColor;
    const derivedAccentSelected =
      mixColor(accentColor, isBrandLight ? "#000000" : "#ffffff", 0.1) ?? accentColor;
    // Accent for text (darkened if light)
    const derivedAccentText = isBrandLight ? mixColor(accentColor, "#000000", 0.6) : accentColor;

    // 1. General
    form.setValue("brandColor.light", brandColor, { shouldDirty: true });
    form.setValue("questionColor.light", derivedDarkTextColor, { shouldDirty: true });

    // Accents (Synced with Brand)
    form.setValue("accentBgColor.light", accentColor, { shouldDirty: true });
    form.setValue("accentBgColorSelected.light", derivedAccentSelected, { shouldDirty: true });

    // Headlines & Descriptions (Using Brand/Accent)
    form.setValue("elementHeadlineColor.light", derivedAccentText, { shouldDirty: true });
    form.setValue(
      "elementDescriptionColor.light",
      mixColor(derivedAccentText, "#ffffff", 0.3) ?? derivedAccentText,
      { shouldDirty: true }
    );
    form.setValue(
      "elementUpperLabelColor.light",
      mixColor(derivedAccentText, "#ffffff", 0.5) ?? derivedAccentText,
      { shouldDirty: true }
    );

    // 2. Buttons
    form.setValue("buttonBgColor.light", brandColor, { shouldDirty: true });
    form.setValue("buttonTextColor.light", isBrandLight ? "#0f172a" : "#ffffff", { shouldDirty: true });

    // 3. Inputs
    form.setValue("inputColor.light", derivedInputBg, { shouldDirty: true });
    form.setValue("inputBorderColor.light", derivedCardBorder, { shouldDirty: true });
    form.setValue("inputTextColor.light", derivedDarkTextColor, { shouldDirty: true });

    // 4. Options (Checkboxes/Radio)
    form.setValue("optionBgColor.light", derivedInputBg, { shouldDirty: true });
    form.setValue("optionLabelColor.light", derivedDarkTextColor, { shouldDirty: true });

    // 5. Card Styling
    form.setValue("cardBackgroundColor.light", derivedCardBg, { shouldDirty: true });
    form.setValue("cardBorderColor.light", derivedCardBorder, { shouldDirty: true });

    // 6. Highlight / Accent (Focus states)
    form.setValue("highlightBorderColor.light", accentColor, { shouldDirty: true });

    // 7. Progress Bar
    form.setValue("progressIndicatorBgColor.light", brandColor, { shouldDirty: true });
    form.setValue("progressTrackBgColor.light", mixColor(brandColor, "#ffffff", 0.8), { shouldDirty: true });

    // 8. Background Styling (Page Background)
    form.setValue(
      "background",
      { bg: derivedPageBg, bgType: "color", brightness: 100 },
      { shouldDirty: true }
    );

    toast.success(t("environments.workspace.look.styling_updated_successfully"));
    setConfirmSuggestColorsOpen(false);
  };

  const onSubmit: SubmitHandler<TProjectStyling> = async (data) => {
    const updatedProjectResponse = await updateProjectAction({
      projectId: project.id,
      data: {
        styling: data,
      },
    });

    if (updatedProjectResponse?.data) {
      form.reset({ ...updatedProjectResponse.data.styling });
      toast.success(t("environments.workspace.look.styling_updated_successfully"));
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
                          <FormLabel>{t("environments.workspace.look.enable_custom_styling")}</FormLabel>
                          <FormDescription>
                            {t("environments.workspace.look.enable_custom_styling_description")}
                          </FormDescription>
                        </div>
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-4 rounded-lg bg-slate-50 p-4">
                <div className="grid grid-cols-2 items-end gap-4">
                  <FormField
                    control={form.control}
                    name="brandColor.light"
                    render={({ field }) => (
                      <FormItem className="space-y-1">
                        <FormLabel className="text-xs">
                          {t("environments.surveys.edit.brand_color")}
                        </FormLabel>
                        <FormControl>
                          <ColorPicker
                            color={field.value ?? COLOR_DEFAULTS.brandColor}
                            onChange={(color) => field.onChange(color)}
                            containerClass="w-full"
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <div className="flex flex-col gap-1">
                    <Button
                      type="button"
                      variant="secondary"
                      className="h-10 w-full justify-center gap-2 border border-slate-300 bg-white text-slate-700 shadow-sm hover:bg-slate-50"
                      onClick={() => setConfirmSuggestColorsOpen(true)}>
                      <SparklesIcon className="mr-2 h-4 w-4" />
                      {t("environments.workspace.look.suggest_colors")}
                    </Button>
                  </div>
                </div>
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
                  isStorageConfigured={isStorageConfigured}
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
            <div className="sticky top-4 mb-4 max-h-[calc(100vh-2rem)]">
              <ThemeStylingPreviewSurvey
                survey={previewSurvey(project.name, t)}
                project={{
                  ...project,
                  styling: form.watch(),
                }}
                previewType={previewSurveyType}
                setPreviewType={setPreviewSurveyType}
                publicDomain={publicDomain}
              />
            </div>
          </div>

          {/* Confirm reset styling modal */}
          <AlertDialog
            open={confirmSuggestColorsOpen}
            setOpen={setConfirmSuggestColorsOpen}
            headerText={t("environments.workspace.look.generate_theme_header")}
            mainText={t("environments.workspace.look.generate_theme_confirmation")}
            confirmBtnLabel={t("environments.workspace.look.generate_theme_btn")}
            declineBtnLabel={t("common.cancel")}
            onConfirm={handleSuggestColors}
            onDecline={() => setConfirmSuggestColorsOpen(false)}
          />

          {/* Confirm reset styling modal */}
          <AlertDialog
            open={confirmResetStylingModalOpen}
            setOpen={setConfirmResetStylingModalOpen}
            headerText={t("environments.workspace.look.reset_styling")}
            mainText={t("environments.workspace.look.reset_styling_confirmation")}
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
