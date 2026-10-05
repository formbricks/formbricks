"use client";

import { RotateCcwIcon } from "lucide-react";
import Link from "next/link";
import React, { useEffect, useMemo, useState } from "react";
import { UseFormReturn, useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { Trans, useTranslation } from "react-i18next";
import { Workspace } from "@formbricks/database/prisma-browser";
import { TSurveyAppearance } from "@formbricks/types/appearance";
import { TSurvey, TSurveyStyling } from "@formbricks/types/surveys/types";
import { TWorkspaceStyling } from "@formbricks/types/workspace";
import { COLOR_DEFAULTS, STYLE_DEFAULTS, getSuggestedColors } from "@/lib/styling/constants";
import { resetStylingAppearance } from "@/lib/styling/reset-appearance";
import { FormStylingSettings } from "@/modules/survey/editor/components/form-styling-settings";
import { LogoSettingsCard } from "@/modules/survey/editor/components/logo-settings-card";
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
import { Switch } from "@/modules/ui/components/switch";

interface StylingViewProps {
  isCustomCssAllowed?: boolean;
  appearance: TSurveyAppearance;
  setAppearance: (appearance: TSurveyAppearance) => void;
  workspaceId: string;
  workspace: Workspace;
  localSurvey: TSurvey;
  setLocalSurvey: React.Dispatch<React.SetStateAction<TSurvey>>;
  colors: string[];
  styling: TSurveyStyling | null;
  setStyling: React.Dispatch<React.SetStateAction<TSurveyStyling | null>>;
  localStylingChanges: TSurveyStyling | null;
  setLocalStylingChanges: React.Dispatch<React.SetStateAction<TSurveyStyling | null>>;
  isUnsplashConfigured: boolean;
  isCxMode: boolean;
  isStorageConfigured: boolean;
}

export const StylingView = ({
  isCustomCssAllowed = false,
  appearance,
  setAppearance,
  colors,
  workspaceId,
  workspace,
  localSurvey,
  setLocalSurvey,
  setStyling,
  styling,
  localStylingChanges,
  setLocalStylingChanges,
  isUnsplashConfigured,
  isCxMode,
  isStorageConfigured = true,
}: StylingViewProps) => {
  const workspaceBasePath = `/workspaces/${workspace.id}`;
  const { t } = useTranslation();

  const savedWorkspaceStyling = workspace.styling as Partial<TWorkspaceStyling> | null;

  // Strip null/undefined values so they don't override STYLE_DEFAULTS.
  const cleanWorkspace = savedWorkspaceStyling
    ? Object.fromEntries(Object.entries(savedWorkspaceStyling).filter(([, v]) => v != null))
    : {};
  const cleanSurvey = localSurvey.styling
    ? Object.fromEntries(Object.entries(localSurvey.styling).filter(([, v]) => v != null))
    : {};

  const form = useForm<TSurveyStyling>({
    defaultValues: {
      ...STYLE_DEFAULTS,
      ...cleanWorkspace,
      ...cleanSurvey,
    },
  });

  const overwriteThemeStyling = form.watch("overwriteThemeStyling");
  const canOverrideTheme = workspace.styling.allowStyleOverwrite && overwriteThemeStyling;
  const setOverwriteThemeStyling = (value: boolean) => form.setValue("overwriteThemeStyling", value);

  const [formStylingOpen, setFormStylingOpen] = useState(false);
  const [logoSettingsOpen, setLogoSettingsOpen] = useState(false);
  const [cardStylingOpen, setCardStylingOpen] = useState(false);
  const [stylingOpen, setStylingOpen] = useState(false);
  const [confirmResetStylingModalOpen, setConfirmResetStylingModalOpen] = useState(false);
  const [confirmSuggestColorsOpen, setConfirmSuggestColorsOpen] = useState(false);

  const handleSuggestColors = () => {
    if (appearance === "dark") {
      form.reset(resetStylingAppearance(form.getValues(), STYLE_DEFAULTS, "dark"));
      setConfirmSuggestColorsOpen(false);
      return;
    }
    const currentBrandColor =
      form.getValues().brandColor?.light ?? STYLE_DEFAULTS.brandColor?.light ?? COLOR_DEFAULTS.brandColor;
    const suggested = getSuggestedColors(currentBrandColor);

    for (const [key, value] of Object.entries(suggested)) {
      form.setValue(key as keyof TSurveyStyling, value, { shouldDirty: true });
    }

    // Footer link color auto-adjusts for contrast when unset; clear any override so it
    // follows the freshly suggested palette instead of a stale custom value.
    form.setValue("footerLinkColor", undefined, { shouldDirty: true });

    toast.success(t("workspace.look.suggested_colors_applied_please_save"));
    setConfirmSuggestColorsOpen(false);
  };

  const onResetThemeStyling = () => {
    const { allowStyleOverwrite, ...baseStyling } = workspace.styling ?? {};

    const reset = {
      ...resetStylingAppearance(form.getValues(), baseStyling, appearance),
      overwriteThemeStyling: true,
    };
    setStyling(reset);
    form.reset(reset);

    setConfirmResetStylingModalOpen(false);
    toast.success(t("workspace.surveys.edit.styling_set_to_theme_styles"));
  };

  useEffect(() => {
    if (!overwriteThemeStyling) {
      setFormStylingOpen(false);
      setLogoSettingsOpen(false);
      setCardStylingOpen(false);
      setStylingOpen(false);
    }
  }, [overwriteThemeStyling]);

  useEffect(() => {
    const subscription = form.watch((data) => {
      setLocalSurvey((prev) => ({
        ...prev,
        styling: {
          ...prev.styling,
          ...(data as TSurveyStyling),
        },
      }));
    });

    return () => subscription.unsubscribe();
  }, [form, setLocalSurvey]);

  const defaultWorkspaceStyling = useMemo(() => {
    const { styling: workspaceStyling } = workspace;
    const { allowStyleOverwrite, ...baseStyling } = workspaceStyling ?? {};

    return baseStyling;
  }, [workspace]);

  const handleOverwriteToggle = (value: boolean) => {
    // survey styling from the server is surveyStyling, it could either be set or not
    // if its set and the toggle is turned off, we set the local styling to the server styling

    setOverwriteThemeStyling(value);

    // if the toggle is turned on, we set the local styling to the workspace styling
    if (value) {
      if (!styling) {
        // copy the workspace styling to the survey styling
        setStyling({
          ...defaultWorkspaceStyling,
          overwriteThemeStyling: true,
        });
        return;
      }

      // if there are local styling changes, we set the styling to the local styling changes that were previously stored
      if (localStylingChanges) {
        setStyling(localStylingChanges);
      }
      // if there are no local styling changes, we set the styling to the workspace styling
      else {
        setStyling({
          ...defaultWorkspaceStyling,
          overwriteThemeStyling: true,
        });
      }
    }

    // if the toggle is turned off, we store the local styling changes and set the styling to the workspace styling
    else {
      // copy the styling to localStylingChanges
      setLocalStylingChanges(styling);

      // copy the workspace styling to the survey styling
      setStyling({
        ...defaultWorkspaceStyling,
        overwriteThemeStyling: false,
      });
    }
  };

  return (
    <StylingAppearanceContext.Provider value={appearance}>
      <FormProvider {...form}>
        <form onSubmit={(e) => e.preventDefault()}>
          <div className="mt-12 space-y-3 p-5">
            {localSurvey.type === "app" && (
              <StylingAppearanceToggle appearance={appearance} onChange={setAppearance} />
            )}
            <div className="flex items-center gap-4 rounded-lg border border-slate-300 bg-white p-4">
              <FormField
                control={form.control}
                name="overwriteThemeStyling"
                render={({ field }) => (
                  <FormItem className="flex items-center gap-4 gap-y-0">
                    <FormControl>
                      <Switch
                        disabled={!workspace.styling.allowStyleOverwrite}
                        id="overwrite-theme-styling"
                        checked={!!field.value}
                        onCheckedChange={handleOverwriteToggle}
                      />
                    </FormControl>

                    <div>
                      <FormLabel
                        htmlFor="overwrite-theme-styling"
                        className="text-base font-semibold text-slate-900">
                        {t("workspace.surveys.edit.add_custom_styles")}
                      </FormLabel>
                      <FormDescription className="text-sm text-slate-500">
                        {t("workspace.surveys.edit.override_theme_with_individual_styles_for_this_survey")}
                      </FormDescription>
                    </div>
                  </FormItem>
                )}
              />
            </div>

            <FormStylingSettings
              open={formStylingOpen}
              setOpen={setFormStylingOpen}
              disabled={!canOverrideTheme}
              form={form as UseFormReturn<TWorkspaceStyling | TSurveyStyling>}
              onSuggestColorsClick={() => setConfirmSuggestColorsOpen(true)}
            />

            <CardStylingSettings
              open={cardStylingOpen}
              setOpen={setCardStylingOpen}
              surveyType={localSurvey.type}
              disabled={!canOverrideTheme}
              form={form as UseFormReturn<TWorkspaceStyling | TSurveyStyling>}
            />

            {localSurvey.type === "link" && (
              <>
                <BackgroundStylingCard
                  open={stylingOpen}
                  setOpen={setStylingOpen}
                  workspaceId={workspaceId}
                  colors={colors}
                  disabled={!canOverrideTheme}
                  isUnsplashConfigured={isUnsplashConfigured}
                  form={form as UseFormReturn<TWorkspaceStyling | TSurveyStyling>}
                  isStorageConfigured={isStorageConfigured}
                />

                <LogoSettingsCard
                  open={logoSettingsOpen}
                  setOpen={setLogoSettingsOpen}
                  disabled={!canOverrideTheme}
                  workspaceId={workspaceId}
                  form={form as UseFormReturn<TWorkspaceStyling | TSurveyStyling>}
                  isStorageConfigured={isStorageConfigured}
                />
              </>
            )}

            <CustomCssCard
              workspaceId={workspaceId}
              surveyId={localSurvey.id}
              value={localSurvey.customCss}
              workspaceCss={workspace.customCss}
              appearance={appearance}
              disabledReason={isCustomCssAllowed ? undefined : "plan"}
              onChange={(customCss) => setLocalSurvey((previous) => ({ ...previous, customCss }))}
            />
            {!isCxMode && (
              <div className="mt-4 flex h-8 items-center justify-between">
                <div>
                  {overwriteThemeStyling && (
                    <Button
                      type="button"
                      variant="ghost"
                      className="flex items-center gap-2"
                      onClick={() => setConfirmResetStylingModalOpen(true)}>
                      {t("workspace.surveys.edit.reset_to_theme_styles")}
                      <RotateCcwIcon className="size-4" />
                    </Button>
                  )}
                </div>
                <p className="text-sm text-slate-500">
                  <Trans
                    i18nKey="workspace.surveys.edit.adjust_theme_in_look_and_feel_settings"
                    components={{
                      lookFeelLink: (
                        <Link
                          href={`${workspaceBasePath}/settings/workspace/look`}
                          target="_blank"
                          className="font-semibold underline"
                        />
                      ),
                    }}
                  />
                </p>
              </div>
            )}
            <AlertDialog
              open={confirmResetStylingModalOpen}
              setOpen={setConfirmResetStylingModalOpen}
              headerText={
                appearance === "dark"
                  ? t("styling.reset_dark")
                  : t("workspace.surveys.edit.reset_to_theme_styles")
              }
              mainText={
                appearance === "dark"
                  ? t("styling.reset_dark_description")
                  : t("workspace.surveys.edit.reset_to_theme_styles_main_text")
              }
              confirmBtnLabel={t("common.confirm")}
              onDecline={() => setConfirmResetStylingModalOpen(false)}
              onConfirm={onResetThemeStyling}
            />

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
          </div>
        </form>
      </FormProvider>
    </StylingAppearanceContext.Provider>
  );
};
