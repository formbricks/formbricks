"use client";

import { useAutoAnimate } from "@formkit/auto-animate/react";
import * as Collapsible from "@radix-ui/react-collapsible";
import { CheckIcon } from "lucide-react";
import React from "react";
import { UseFormReturn } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { TProjectStyling } from "@formbricks/types/project";
import { TSurveyStyling, TSurveyType } from "@formbricks/types/surveys/types";
import { cn } from "@/lib/cn";
import { COLOR_DEFAULTS } from "@/lib/styling/constants";
import { CardArrangementTabs } from "@/modules/ui/components/card-arrangement-tabs";
import { ColorPicker } from "@/modules/ui/components/color-picker";
import { FormControl, FormDescription, FormField, FormItem, FormLabel } from "@/modules/ui/components/form";
import { Input } from "@/modules/ui/components/input";
import { Switch } from "@/modules/ui/components/switch";

type CardStylingSettingsProps = {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isSettingsPage?: boolean;
  surveyType?: TSurveyType;
  disabled?: boolean;
  form: UseFormReturn<TProjectStyling | TSurveyStyling>;
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
            <div className="flex items-center pr-5 pl-2">
              <CheckIcon
                strokeWidth={3}
                className="h-7 w-7 rounded-full border border-green-300 bg-green-100 p-1.5 text-green-600"
              />
            </div>
          )}

          <div>
            <p className={cn("font-semibold text-slate-800", isSettingsPage ? "text-sm" : "text-base")}>
              {t("environments.surveys.edit.card_styling")}
            </p>
            <p className={cn("mt-1 text-slate-500", isSettingsPage ? "text-xs" : "text-sm")}>
              {t("environments.surveys.edit.style_the_survey_card")}
            </p>
          </div>
        </div>
      </Collapsible.CollapsibleTrigger>

      <Collapsible.CollapsibleContent className="flex flex-col" ref={parent}>
        <hr className="py-1 text-slate-600" />

        <div className="grid grid-cols-2 gap-4 p-6 pt-2">
          {/* Roundness */}
          <DimensionInput form={form} name="roundness" label={t("environments.surveys.edit.roundness")} />

          <FormField
            control={form.control}
            name="cardBackgroundColor.light"
            render={({ field }) => (
              <FormItem className="space-y-1">
                <FormLabel className="text-xs">
                  {t("environments.surveys.edit.card_background_color")}
                </FormLabel>

                <FormControl>
                  <ColorPicker
                    color={field.value || COLOR_DEFAULTS.cardBackgroundColor}
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
                <FormLabel className="text-xs">{t("environments.surveys.edit.card_border_color")}</FormLabel>

                <FormControl>
                  <ColorPicker
                    color={field.value || COLOR_DEFAULTS.cardBorderColor}
                    onChange={(color) => field.onChange(color)}
                    containerClass="max-w-xs"
                  />
                </FormControl>
              </FormItem>
            )}
          />

          {(!surveyType || isAppSurvey) && (
            <div className="flex max-w-xs flex-col gap-4">
              <div className="flex items-center space-x-1">
                <FormField
                  control={form.control}
                  name="highlightBorderColor"
                  render={({ field }) => (
                    <FormItem className="flex w-full flex-col gap-2 space-y-0">
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
                                light: COLOR_DEFAULTS.highlightBorderColor,
                              });
                            }}
                          />
                        </FormControl>

                        <div>
                          <FormLabel>{t("environments.surveys.edit.add_highlight_border")}</FormLabel>
                        </div>
                      </div>

                      {!!field.value && (
                        <FormControl>
                          <ColorPicker
                            color={field.value?.light ?? COLOR_DEFAULTS.highlightBorderColor}
                            onChange={(color: string) =>
                              field.onChange({
                                ...field.value,
                                light: color,
                              })
                            }
                            containerClass="my-0"
                          />
                        </FormControl>
                      )}
                    </FormItem>
                  )}
                />
              </div>
            </div>
          )}

          <FormField
            control={form.control}
            name={"cardArrangement"}
            render={() => (
              <FormItem className="col-span-2">
                <div>
                  <FormLabel>
                    {t("environments.surveys.edit.card_arrangement_for_survey_type_derived", {
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
                      type === "app"
                        ? form.setValue("cardArrangement.appSurveys", value)
                        : form.setValue("cardArrangement.linkSurveys", value);
                    }}
                  />
                </FormControl>
              </FormItem>
            )}
          />
        </div>

        {/* Progress Bar Section (Moved from Advanced) */}
        <div className="flex flex-col gap-6 p-6 pt-0">
          <hr className="text-slate-600" />
          <div className="flex flex-col gap-4">
            <div className="my-2">
              <FormField
                control={form.control}
                name="hideProgressBar"
                render={({ field }) => (
                  <FormItem className="flex w-full items-center gap-2 space-y-0">
                    <FormControl>
                      <Switch
                        id="hideProgressBar"
                        checked={!!field.value}
                        onCheckedChange={(checked) => field.onChange(checked)}
                      />
                    </FormControl>

                    <div>
                      <FormLabel className="text-sm font-normal">
                        {t("environments.surveys.edit.hide_progress_bar")}
                      </FormLabel>
                      <FormDescription className="text-xs">
                        {t("environments.surveys.edit.disable_the_visibility_of_survey_progress")}
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
                  label={t("environments.workspace.look.advanced_styling_field_track_bg")}
                />
                <ColorField
                  form={form}
                  name="progressIndicatorBgColor.light"
                  label={t("environments.workspace.look.advanced_styling_field_indicator_bg")}
                />
                <DimensionInput
                  form={form}
                  name="progressTrackHeight"
                  label={t("environments.workspace.look.advanced_styling_field_track_height")}
                />
              </div>
            )}
          </div>
        </div>
      </Collapsible.CollapsibleContent>
    </Collapsible.Root>
  );
};

const ColorField = ({ form, name, label }: { form: any; name: string; label: string }) => (
  <FormField
    control={form.control}
    name={name}
    render={({ field }) => (
      <FormItem className="space-y-1">
        <FormLabel className="text-xs">{label}</FormLabel>
        <FormControl>
          <ColorPicker
            color={field.value}
            onChange={(color) => field.onChange(color)}
            containerClass="w-full"
          />
        </FormControl>
      </FormItem>
    )}
  />
);

const DimensionInput = ({
  form,
  name,
  label,
  placeholder,
}: {
  form: any;
  name: string;
  label: string;
  placeholder?: string;
}) => (
  <FormField
    control={form.control}
    name={name}
    render={({ field }) => {
      const value = field.value;
      const isPercentage = typeof value === "string" && value.endsWith("%");
      const unit = isPercentage ? "%" : "px";
      const numericValue = isPercentage ? Number.parseFloat(value) : value;

      return (
        <FormItem className="space-y-1">
          <FormLabel className="text-xs">{label}</FormLabel>
          <FormControl>
            <div className="flex rounded-md shadow-xs">
              <Input
                type="number"
                value={numericValue ?? ""}
                onChange={(e) => {
                  const valStr = e.target.value;
                  if (valStr === "") {
                    field.onChange(null);
                    return;
                  }
                  const newVal = Number.parseFloat(valStr);
                  if (Number.isNaN(newVal)) {
                    return;
                  }
                  field.onChange(unit === "%" ? `${newVal}%` : newVal);
                }}
                className="flex-1 rounded-r-none border-r-0 text-xs focus-visible:ring-0"
                placeholder={placeholder}
              />
              <select
                value={unit}
                onChange={(e) => {
                  const newUnit = e.target.value;
                  const currentVal = numericValue ?? 0;
                  field.onChange(newUnit === "%" ? `${currentVal}%` : currentVal);
                }}
                className="ring-offset-background placeholder:text-muted-foreground focus:border-brand-dark h-10 items-center justify-between rounded-r-md border border-slate-300 bg-white pr-8 pl-3 text-xs font-medium focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 focus:outline-hidden disabled:cursor-not-allowed disabled:opacity-50">
                <option value="px">px</option>
                <option value="%">%</option>
                <option value="rem">rem</option>
                <option value="em">em</option>
              </select>
            </div>
          </FormControl>
        </FormItem>
      );
    }}
  />
);
