"use client";

import { useAutoAnimate } from "@formkit/auto-animate/react";
import * as Collapsible from "@radix-ui/react-collapsible";
import { CheckIcon } from "lucide-react";
import React from "react";
import { UseFormReturn } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { TSurveyStyling, TSurveyType } from "@formbricks/types/surveys/types";
import { TWorkspaceStyling } from "@formbricks/types/workspace";
import { cn } from "@/lib/cn";
import { STYLE_DEFAULTS } from "@/lib/styling/constants";
import { CardArrangementTabs } from "@/modules/ui/components/card-arrangement-tabs";
import { CardWidthTabs } from "@/modules/ui/components/card-width-tabs";
import { ColorPicker } from "@/modules/ui/components/color-picker";
import { FormControl, FormDescription, FormField, FormItem, FormLabel } from "@/modules/ui/components/form";
import { ColorField, DimensionInput } from "@/modules/ui/components/styling-fields";
import { Switch } from "@/modules/ui/components/switch";

type CardStylingSettingsProps = {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isSettingsPage?: boolean;
  surveyType?: TSurveyType;
  disabled?: boolean;
  form: UseFormReturn<TWorkspaceStyling | TSurveyStyling>;
};

export const CardStylingSettings = ({
  isSettingsPage = false,
  surveyType,
  disabled,
  open,
  setOpen,
  form,
}: CardStylingSettingsProps) => {
  const { t } = useTranslation();
  const isAppSurvey = surveyType === "app";
  const surveyTypeDerived = isAppSurvey ? "App" : "Link";

  const linkCardArrangement = form.watch("cardArrangement.linkSurveys") ?? "straight";
  const appCardArrangement = form.watch("cardArrangement.appSurveys") ?? "straight";
  const linkSurveyCardWidth = form.watch("linkSurveyCardWidth") ?? "default";
  const hideProgressBar = form.watch("hideProgressBar");

  const [parent] = useAutoAnimate();

  return (
    <Collapsible.Root
      open={open}
      onOpenChange={(openState) => {
        if (disabled) return;
        setOpen(openState);
      }}
      className="w-full rounded-lg border border-slate-300 bg-white">
      <Collapsible.CollapsibleTrigger
        asChild
        disabled={disabled}
        className={cn(
          "w-full cursor-pointer rounded-lg hover:bg-slate-50",
          disabled && "cursor-not-allowed opacity-60 hover:bg-white"
        )}>
        <div className="inline-flex px-4 py-4">
          {!isSettingsPage && (
            <div className="flex items-center pl-2 pr-5">
              <CheckIcon
                strokeWidth={3}
                className="size-7 rounded-full border border-green-300 bg-green-100 p-1.5 text-green-600"
              />
            </div>
          )}

          <div>
            <p className={cn("font-semibold text-slate-800", isSettingsPage ? "text-sm" : "text-base")}>
              {t("workspace.surveys.edit.card_styling")}
            </p>
            <p className={cn("mt-1 text-slate-500", isSettingsPage ? "text-xs" : "text-sm")}>
              {t("workspace.surveys.edit.style_the_survey_card")}
            </p>
          </div>
        </div>
      </Collapsible.CollapsibleTrigger>

      <Collapsible.CollapsibleContent className="flex flex-col" ref={parent}>
        <hr className="py-1 text-slate-600" />

        <div className="grid grid-cols-2 gap-4 p-6 pt-2">
          {/* Roundness */}
          <DimensionInput
            form={form}
            name="roundness"
            label={t("workspace.surveys.edit.roundness")}
            description={t("workspace.surveys.edit.roundness_description")}
          />

          <FormField
            control={form.control}
            name="cardBackgroundColor.light"
            render={({ field }) => (
              <FormItem className="space-y-1">
                <FormLabel>{t("workspace.surveys.edit.card_background_color")}</FormLabel>
                <FormDescription>
                  {t("workspace.surveys.edit.card_background_color_description")}
                </FormDescription>

                <FormControl>
                  <ColorPicker
                    color={field.value || STYLE_DEFAULTS.cardBackgroundColor?.light || "#ffffff"}
                    onChange={(color) => field.onChange(color)}
                    containerClass="max-w-xs"
                  />
                </FormControl>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="cardBorderColor.light"
            render={({ field }) => (
              <FormItem className="space-y-1">
                <FormLabel>{t("workspace.surveys.edit.card_border_color")}</FormLabel>
                <FormDescription>{t("workspace.surveys.edit.card_border_color_description")}</FormDescription>

                <FormControl>
                  <ColorPicker
                    color={field.value || STYLE_DEFAULTS.cardBorderColor?.light || "#f8fafc"}
                    onChange={(color) => field.onChange(color)}
                    containerClass="max-w-xs"
                  />
                </FormControl>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name={"cardArrangement"}
            render={() => (
              <FormItem className="col-span-2">
                <div>
                  <FormLabel>
                    {t("workspace.surveys.edit.card_arrangement_for_survey_type_derived", {
                      surveyTypeDerived: surveyTypeDerived,
                    })}
                  </FormLabel>
                </div>
                <FormControl>
                  <CardArrangementTabs
                    key={isAppSurvey ? "app" : "link"}
                    surveyType={isAppSurvey ? "app" : "link"}
                    activeCardArrangement={isAppSurvey ? appCardArrangement : linkCardArrangement}
                    setActiveCardArrangement={(value, type) => {
                      if (type === "app") {
                        // "cardless" is not offered for app surveys, so it can be safely excluded here.
                        if (value !== "cardless") {
                          form.setValue("cardArrangement.appSurveys", value);
                        }
                      } else {
                        form.setValue("cardArrangement.linkSurveys", value);
                      }
                    }}
                  />
                </FormControl>
              </FormItem>
            )}
          />

          {!isAppSurvey && (
            <FormField
              control={form.control}
              name="linkSurveyCardWidth"
              render={() => (
                <FormItem className="col-span-2">
                  <div>
                    <FormLabel>{t("workspace.surveys.edit.card_width_for_link_surveys")}</FormLabel>
                  </div>
                  <FormControl>
                    <CardWidthTabs
                      activeCardWidth={linkSurveyCardWidth}
                      setActiveCardWidth={(value) => {
                        form.setValue("linkSurveyCardWidth", value);
                      }}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          )}
        </div>

        {/* Highlight Border Section */}
        <div className="flex flex-col gap-4 p-6 pt-0">
          <hr className="text-slate-600" />
          <div className="my-2">
            <FormField
              control={form.control}
              name="highlightBorderColor"
              render={({ field }) => (
                <FormItem className="flex w-full flex-col gap-4 gap-y-0">
                  <div className="flex items-center gap-2">
                    <FormControl>
                      <Switch
                        id="highlightBorderColor"
                        checked={!!field.value}
                        onCheckedChange={(checked) => {
                          if (!checked) {
                            field.onChange(null);
                            return;
                          }
                          field.onChange({
                            light: STYLE_DEFAULTS.highlightBorderColor?.light,
                          });
                        }}
                      />
                    </FormControl>
                    <div>
                      <FormLabel className="text-sm font-normal">
                        {t("workspace.surveys.edit.add_highlight_border")}
                      </FormLabel>
                      <FormDescription className="text-xs">
                        {t("workspace.surveys.edit.add_highlight_border_description")}
                      </FormDescription>
                    </div>
                  </div>

                  {!!field.value && (
                    <FormControl>
                      <ColorPicker
                        color={field.value?.light ?? STYLE_DEFAULTS.highlightBorderColor?.light}
                        onChange={(color: string) =>
                          field.onChange({
                            ...field.value,
                            light: color,
                          })
                        }
                        containerClass="w-1/2"
                      />
                    </FormControl>
                  )}
                </FormItem>
              )}
            />
          </div>
        </div>

        {/* Progress Bar Section */}
        <div className="flex flex-col gap-6 p-6 pt-0">
          <hr className="text-slate-600" />
          <div className="flex flex-col gap-4">
            <div className="my-2">
              <FormField
                control={form.control}
                name="hideProgressBar"
                render={({ field }) => (
                  <FormItem className="flex w-full items-center gap-2 gap-y-0">
                    <FormControl>
                      <Switch
                        id="hideProgressBar"
                        checked={!!field.value}
                        onCheckedChange={(checked) => field.onChange(checked)}
                      />
                    </FormControl>

                    <div>
                      <FormLabel className="text-sm font-normal">
                        {t("workspace.surveys.edit.hide_progress_bar")}
                      </FormLabel>
                      <FormDescription className="text-xs">
                        {t("workspace.surveys.edit.disable_the_visibility_of_survey_progress")}
                      </FormDescription>
                    </div>
                  </FormItem>
                )}
              />
            </div>
            {!hideProgressBar && (
              <div className="grid grid-cols-2 gap-4">
                <ColorField
                  form={form}
                  name="progressTrackBgColor.light"
                  label={t("workspace.look.advanced_styling_field_track_bg")}
                  description={t("workspace.look.advanced_styling_field_track_bg_description")}
                />
                <ColorField
                  form={form}
                  name="progressIndicatorBgColor.light"
                  label={t("workspace.look.advanced_styling_field_indicator_bg")}
                  description={t("workspace.look.advanced_styling_field_indicator_bg_description")}
                />
                <DimensionInput
                  form={form}
                  name="progressTrackHeight"
                  label={t("workspace.look.advanced_styling_field_track_height")}
                  description={t("workspace.look.advanced_styling_field_track_height_description")}
                />
              </div>
            )}
          </div>
        </div>
      </Collapsible.CollapsibleContent>
    </Collapsible.Root>
  );
};
