"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { RotateCcwIcon, SparklesIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { SubmitHandler, UseFormReturn, useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { TSurveyAppearance } from "@formbricks/types/appearance";
import { TCustomCss } from "@formbricks/types/custom-css";
import { TSurveyStyling, TSurveyType } from "@formbricks/types/surveys/types";
import { TWorkspace } from "@formbricks/types/workspace";
import { TWorkspaceStyling, ZWorkspaceStyling } from "@formbricks/types/workspace";
import { previewSurvey } from "@/app/lib/templates";
import { COLOR_DEFAULTS, STYLE_DEFAULTS, getSuggestedColors } from "@/lib/styling/constants";
import { resetStylingAppearance } from "@/lib/styling/reset-appearance";
import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { FormStylingSettings } from "@/modules/survey/editor/components/form-styling-settings";
import { Alert, AlertDescription } from "@/modules/ui/components/alert";
import { AlertDialog } from "@/modules/ui/components/alert-dialog";
import { BackgroundStylingCard } from "@/modules/ui/components/background-styling-card";
import { Button } from "@/modules/ui/components/button";
import { CardStylingSettings } from "@/modules/ui/components/card-styling-settings";
import { CustomCssCard } from "@/modules/ui/components/custom-css-card";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormProvider,
} from "@/modules/ui/components/form";
import {
  StylingAppearanceContext,
  StylingAppearanceToggle,
} from "@/modules/ui/components/styling-appearance";
import { ColorField } from "@/modules/ui/components/styling-fields";
import { Switch } from "@/modules/ui/components/switch";
import { ThemeStylingPreviewSurvey } from "@/modules/ui/components/theme-styling-preview-survey";
import { updateWorkspaceAction } from "@/modules/workspaces/settings/actions";

interface ThemeStylingProps {
  isCustomCssAllowed?: boolean;
  canEditWorkspaceCss?: boolean;
  workspace: TWorkspace;
  workspaceId: string;
  colors: string[];
  isUnsplashConfigured: boolean;
  isReadOnly: boolean;
  isStorageConfigured: boolean;
  publicDomain: string;
}

export const ThemeStyling = ({
  isCustomCssAllowed = false,
  canEditWorkspaceCss = false,
  workspace,
  workspaceId,
  colors,
  isUnsplashConfigured,
  isReadOnly,
  isStorageConfigured = true,
  publicDomain,
}: ThemeStylingProps) => {
  const { t } = useTranslation();
  const [appearance, setAppearance] = useState<TSurveyAppearance>("light");
  const [customCss, setCustomCss] = useState<TCustomCss | null>(workspace.customCss ?? null);
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
    const nextStyling = resetStylingAppearance(form.getValues(), STYLE_DEFAULTS, appearance);
    const updatedWorkspaceResponse = await updateWorkspaceAction({
      workspaceId: workspace.id,
      data: {
        styling: nextStyling,
      },
    });

    if (updatedWorkspaceResponse?.data) {
      form.reset(nextStyling);
      setPreviewBrandColor(nextStyling.brandColor?.light ?? COLOR_DEFAULTS.brandColor);
      toast.success(t("workspace.look.styling_updated_successfully"));
      router.refresh();
    } else {
      const errorMessage = getFormattedErrorMessage(updatedWorkspaceResponse);
      toast.error(errorMessage);
    }
  }, [form, workspace.id, router, t, appearance]);

  const handleSuggestColors = () => {
    if (appearance === "dark") {
      form.reset(resetStylingAppearance(form.getValues(), STYLE_DEFAULTS, "dark"));
      setConfirmSuggestColorsOpen(false);
      return;
    }
    const brandColor = form.getValues().brandColor?.light ?? STYLE_DEFAULTS.brandColor?.light;
    const suggested = getSuggestedColors(brandColor);

    for (const [key, value] of Object.entries(suggested)) {
      form.setValue(key as keyof TWorkspaceStyling, value, { shouldDirty: true });
    }

    // Footer link color auto-adjusts for contrast when unset; clear any override so it
    // follows the freshly suggested palette instead of a stale custom value.
    form.setValue("footerLinkColor", undefined, { shouldDirty: true });

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
        customCss,
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
      <Alert variant="warning" role="status">
        <AlertDescription>
          {t("common.only_owners_managers_and_manage_access_members_can_perform_this_action")}
        </AlertDescription>
      </Alert>
    );
  }
  return (
    <StylingAppearanceContext.Provider value={appearance}>
      <FormProvider {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <div className="flex">
            {/* Styling settings */}
            <div className="relative flex w-1/2 flex-col pr-6">
              <div className="flex flex-1 flex-col gap-4">
                <StylingAppearanceToggle
                  appearance={appearance}
                  onChange={(value) => {
                    setAppearance(value);
                    if (value === "dark") setPreviewSurveyType("app");
                  }}
                />
                <div className="flex flex-col gap-4 rounded-lg bg-slate-50 p-4">
                  <div className="flex items-center gap-6">
                    <FormField
                      control={form.control}
                      name="allowStyleOverwrite"
                      render={({ field }) => (
                        <FormItem className="flex w-full items-center gap-2 gap-y-0">
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
                    <ColorField
                      form={form as UseFormReturn<TWorkspaceStyling | TSurveyStyling>}
                      name="brandColor.light"
                      label={t("workspace.surveys.edit.brand_color")}
                      description={t("workspace.surveys.edit.brand_color_description")}
                    />
                    <div className="flex flex-col gap-1">
                      <Button
                        type="button"
                        variant="default"
                        className="h-10 justify-center gap-1"
                        onClick={() => setConfirmSuggestColorsOpen(true)}>
                        <SparklesIcon className="mr-2 size-4" />
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

              <div className="mt-4">
                <CustomCssCard
                  workspaceId={workspaceId}
                  appearance={appearance}
                  value={customCss}
                  onChange={setCustomCss}
                  disabledReason={!isCustomCssAllowed ? "plan" : !canEditWorkspaceCss ? "role" : undefined}
                />
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
                  <RotateCcwIcon className="size-4" />
                </Button>
              </div>
            </div>

            {/* Survey Preview */}

            <div className="relative w-1/2 rounded-lg bg-slate-100 pt-4">
              <div className="sticky top-4 mb-4 max-h-[calc(100vh-2rem)]">
                <ThemeStylingPreviewSurvey
                  appearance={appearance}
                  survey={previewSurvey(workspace.name, t)}
                  workspace={{
                    ...workspace,
                    customCss,
                    styling: {
                      ...form.watch(),
                      brandColor: { ...form.watch("brandColor"), light: previewBrandColor },
                    },
                  }}
                  previewType={previewSurveyType}
                  setPreviewType={(type) => {
                    setPreviewSurveyType(type);
                    if (type === "link") setAppearance("light");
                  }}
                  publicDomain={publicDomain}
                />
              </div>
            </div>

            {/* Confirm reset styling modal */}
            <AlertDialog
              open={confirmSuggestColorsOpen}
              setOpen={setConfirmSuggestColorsOpen}
              headerText={
                appearance === "dark" ? t("styling.reset_dark") : t("workspace.look.generate_theme_header")
              }
              mainText={
                appearance === "dark"
                  ? t("styling.reset_dark_description")
                  : t("workspace.look.generate_theme_confirmation")
              }
              confirmBtnLabel={t("workspace.look.generate_theme_btn")}
              declineBtnLabel={t("common.cancel")}
              onConfirm={handleSuggestColors}
              onDecline={() => setConfirmSuggestColorsOpen(false)}
            />

            {/* Confirm reset styling modal */}
            <AlertDialog
              open={confirmResetStylingModalOpen}
              setOpen={setConfirmResetStylingModalOpen}
              headerText={appearance === "dark" ? t("styling.reset_dark") : t("workspace.look.reset_styling")}
              mainText={
                appearance === "dark"
                  ? t("styling.reset_dark_description")
                  : t("workspace.look.reset_styling_confirmation")
              }
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
    </StylingAppearanceContext.Provider>
  );
};
