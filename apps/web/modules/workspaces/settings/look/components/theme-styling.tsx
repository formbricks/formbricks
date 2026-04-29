"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { RotateCcwIcon, SparklesIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { SubmitHandler, UseFormReturn, useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { TSurveyStyling, TSurveyType } from "@formbricks/types/surveys/types";
import { TWorkspace } from "@formbricks/types/workspace";
import { TWorkspaceStyling, ZWorkspaceStyling } from "@formbricks/types/workspace";
import { previewSurvey } from "@/app/lib/templates";
import { COLOR_DEFAULTS, STYLE_DEFAULTS, getSuggestedColors } from "@/lib/styling/constants";
import { getFormattedErrorMessage } from "@/lib/utils/helper";
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
import { updateWorkspaceAction } from "@/modules/workspaces/settings/actions";

interface ThemeStylingProps {
  workspace: TWorkspace;
  workspaceId: string;
  colors: string[];
  isUnsplashConfigured: boolean;
  isReadOnly: boolean;
  isStorageConfigured: boolean;
  publicDomain: string;
}

export const ThemeStyling = ({
  workspace,
  workspaceId,
  colors,
  isUnsplashConfigured,
  isReadOnly,
  isStorageConfigured = true,
  publicDomain,
}: ThemeStylingProps) => {
  const { t } = useTranslation();
  const router = useRouter();

  const savedStyling = workspace.styling as Partial<TWorkspaceStyling> | null;

  // Strip null/undefined values so they don't override STYLE_DEFAULTS.
  // Saved styling from before advanced fields existed will have nullish entries.
  const cleanSaved = savedStyling
    ? Object.fromEntries(Object.entries(savedStyling).filter(([, v]) => v != null))
    : {};

  const form = useForm<TWorkspaceStyling>({
    defaultValues: { ...STYLE_DEFAULTS, ...cleanSaved },
    resolver: zodResolver(ZWorkspaceStyling),
  });

  // Brand color shown in the preview.  Only updated when the user triggers
  // "Suggest colors", "Save", or "Reset to default" — NOT on every keystroke
  // in the brand-color picker.  This prevents the loading-spinner / progress
  // bar from updating while the user is still picking a colour.
  const [previewBrandColor, setPreviewBrandColor] = useState<string>(
    (cleanSaved as Partial<TWorkspaceStyling>).brandColor?.light ??
      STYLE_DEFAULTS.brandColor?.light ??
      COLOR_DEFAULTS.brandColor
  );

  const [previewSurveyType, setPreviewSurveyType] = useState<TSurveyType>("link");
  const [confirmResetStylingModalOpen, setConfirmResetStylingModalOpen] = useState(false);
  const [confirmSuggestColorsOpen, setConfirmSuggestColorsOpen] = useState(false);

  const [formStylingOpen, setFormStylingOpen] = useState(false);
  const [cardStylingOpen, setCardStylingOpen] = useState(false);
  const [backgroundStylingOpen, setBackgroundStylingOpen] = useState(false);
  const onReset = useCallback(async () => {
    const updatedWorkspaceResponse = await updateWorkspaceAction({
      workspaceId: workspace.id,
      data: {
        styling: { ...STYLE_DEFAULTS },
      },
    });

    if (updatedWorkspaceResponse?.data) {
      form.reset({ ...STYLE_DEFAULTS });
      setPreviewBrandColor(STYLE_DEFAULTS.brandColor?.light ?? COLOR_DEFAULTS.brandColor);
      toast.success(t("workspace.look.styling_updated_successfully"));
      router.refresh();
    } else {
      const errorMessage = getFormattedErrorMessage(updatedWorkspaceResponse);
      toast.error(errorMessage);
    }
  }, [form, workspace.id, router, t]);

  const handleSuggestColors = () => {
    const brandColor = form.getValues().brandColor?.light ?? STYLE_DEFAULTS.brandColor?.light;
    const suggested = getSuggestedColors(brandColor);

    for (const [key, value] of Object.entries(suggested)) {
      form.setValue(key as keyof TWorkspaceStyling, value, { shouldDirty: true });
    }

    // Commit brand color to the preview now that all derived colours are in sync.
    setPreviewBrandColor(brandColor ?? STYLE_DEFAULTS.brandColor?.light ?? COLOR_DEFAULTS.brandColor);

    toast.success(t("workspace.look.suggested_colors_applied_please_save"));
    setConfirmSuggestColorsOpen(false);
  };

  const onSubmit: SubmitHandler<TWorkspaceStyling> = async (data) => {
    const updatedWorkspaceResponse = await updateWorkspaceAction({
      workspaceId: workspace.id,
      data: {
        styling: data,
      },
    });

    if (updatedWorkspaceResponse?.data) {
      const saved = updatedWorkspaceResponse.data.styling;
      form.reset({ ...saved });
      setPreviewBrandColor(
        saved?.brandColor?.light ?? STYLE_DEFAULTS.brandColor?.light ?? COLOR_DEFAULTS.brandColor
      );
      toast.success(t("workspace.look.styling_updated_successfully"));
    } else {
      const errorMessage = getFormattedErrorMessage(updatedWorkspaceResponse);
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
                          <FormLabel>{t("workspace.look.enable_custom_styling")}</FormLabel>
                          <FormDescription>
                            {t("workspace.look.enable_custom_styling_description")}
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
                        <FormLabel>{t("workspace.surveys.edit.brand_color")}</FormLabel>
                        <FormDescription>
                          {t("workspace.surveys.edit.brand_color_description")}
                        </FormDescription>
                        <FormControl>
                          <ColorPicker
                            color={
                              field.value ?? STYLE_DEFAULTS.brandColor?.light ?? COLOR_DEFAULTS.brandColor
                            }
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
                      variant="default"
                      className="h-10 justify-center gap-1"
                      onClick={() => setConfirmSuggestColorsOpen(true)}>
                      <SparklesIcon className="mr-2 h-4 w-4" />
                      {t("workspace.look.suggest_colors")}
                    </Button>
                  </div>
                </div>
                <FormStylingSettings
                  open={formStylingOpen}
                  setOpen={setFormStylingOpen}
                  isSettingsPage
                  form={form as UseFormReturn<TWorkspaceStyling | TSurveyStyling>}
                />

                <CardStylingSettings
                  open={cardStylingOpen}
                  setOpen={setCardStylingOpen}
                  isSettingsPage
                  surveyType={previewSurveyType}
                  form={form as UseFormReturn<TWorkspaceStyling | TSurveyStyling>}
                />

                <BackgroundStylingCard
                  open={backgroundStylingOpen}
                  setOpen={setBackgroundStylingOpen}
                  workspaceId={workspaceId}
                  colors={colors}
                  isSettingsPage
                  isUnsplashConfigured={isUnsplashConfigured}
                  form={form as UseFormReturn<TWorkspaceStyling | TSurveyStyling>}
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
                survey={previewSurvey(workspace.name, t)}
                workspace={{
                  ...workspace,
                  styling: { ...form.watch(), brandColor: { light: previewBrandColor } },
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
            headerText={t("workspace.look.generate_theme_header")}
            mainText={t("workspace.look.generate_theme_confirmation")}
            confirmBtnLabel={t("workspace.look.generate_theme_btn")}
            declineBtnLabel={t("common.cancel")}
            onConfirm={handleSuggestColors}
            onDecline={() => setConfirmSuggestColorsOpen(false)}
          />

          {/* Confirm reset styling modal */}
          <AlertDialog
            open={confirmResetStylingModalOpen}
            setOpen={setConfirmResetStylingModalOpen}
            headerText={t("workspace.look.reset_styling")}
            mainText={t("workspace.look.reset_styling_confirmation")}
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
