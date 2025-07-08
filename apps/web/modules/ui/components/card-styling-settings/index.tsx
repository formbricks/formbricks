"use client";

import { cn } from "@/lib/cn";
import { COLOR_DEFAULTS } from "@/lib/styling/constants";
import { Badge } from "@/modules/ui/components/badge";
import { CardArrangementTabs } from "@/modules/ui/components/card-arrangement-tabs";
import { ColorPicker } from "@/modules/ui/components/color-picker";
import { FormControl, FormDescription, FormField, FormItem, FormLabel } from "@/modules/ui/components/form";
import { Slider } from "@/modules/ui/components/slider";
import { Switch } from "@/modules/ui/components/switch";
import { useAutoAnimate } from "@formkit/auto-animate/react";
import { Project } from "@prisma/client";
import * as Collapsible from "@radix-ui/react-collapsible";
import { useTranslate } from "@tolgee/react";
import { CheckIcon } from "lucide-react";
import React from "react";
import { UseFormReturn } from "react-hook-form";
import { TProjectStyling } from "@formbricks/types/project";
import { TSurveyStyling, TSurveyType } from "@formbricks/types/surveys/types";

type CardStylingSettingsProps = {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isSettingsPage?: boolean;
  surveyType?: TSurveyType;
  disabled?: boolean;
  project: Project;
  form: UseFormReturn<TProjectStyling | TSurveyStyling>;
};

export const CardStylingSettings = ({
  isSettingsPage = false,
  surveyType,
  disabled,
  open,
  project,
  setOpen,
  form,
}: CardStylingSettingsProps) => {
  const { t } = useTranslate();
  const isAppSurvey = surveyType === "app";
  const surveyTypeDerived = isAppSurvey ? "App" : "Link";
  const isLogoVisible = !!project.logo?.url;

  const linkCardArrangement = form.watch("cardArrangement.linkSurveys") ?? "straight";
  const appCardArrangement = form.watch("cardArrangement.appSurveys") ?? "straight";
  const roundness = form.watch("roundness") ?? 8;

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

        <div className="flex flex-col gap-6 p-6 pt-2">
          <div className="flex flex-col justify-center">
            <FormField
              control={form.control}
              name="roundness"
              render={() => (
                <FormItem>
                  <div>
                    <FormLabel>{t("environments.surveys.edit.roundness")}</FormLabel>
                    <FormDescription>
                      {t("environments.surveys.edit.change_the_border_radius_of_the_card_and_the_inputs")}
                    </FormDescription>
                  </div>

                  <FormControl>
                    <div className="rounded-lg border bg-slate-50 p-6">
                      <Slider
                        value={[roundness]}
                        max={22}
                        onValueChange={(value) => {
                          form.setValue("roundness", value[0]);
                        }}
                      />
                    </div>
                  </FormControl>
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="cardBackgroundColor.light"
            render={({ field }) => (
              <FormItem className="space-y-4">
                <div>
                  <FormLabel>{t("environments.surveys.edit.card_background_color")}</FormLabel>
                  <FormDescription>
                    {t("environments.surveys.edit.change_the_background_color_of_the_card")}
                  </FormDescription>
                </div>

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
              <FormItem className="space-y-4">
                <div>
                  <FormLabel>{t("environments.surveys.edit.card_border_color")}</FormLabel>
                  <FormDescription>
                    {t("environments.surveys.edit.change_the_border_color_of_the_card")}
                  </FormDescription>
                </div>

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

          <FormField
            control={form.control}
            name={"cardArrangement"}
            render={() => (
              <FormItem>
                <div>
                  <FormLabel>
                    {t("environments.surveys.edit.card_arrangement_for_survey_type_derived", {
                      surveyTypeDerived: surveyTypeDerived,
                    })}
                  </FormLabel>
                  <FormDescription>
                    {t(
                      "environments.surveys.edit.how_funky_do_you_want_your_cards_in_survey_type_derived_surveys",
                      {
                        surveyTypeDerived: surveyTypeDerived,
                      }
                    )}
                  </FormDescription>
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
          <div className="flex items-center space-x-1">
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
                    <FormLabel>{t("environments.surveys.edit.hide_progress_bar")}</FormLabel>
                    <FormDescription>
                      {t("environments.surveys.edit.disable_the_visibility_of_survey_progress")}
                    </FormDescription>
                  </div>
                </FormItem>
              )}
            />
          </div>

          {isLogoVisible && (!surveyType || surveyType === "link") && !isSettingsPage && (
            <div className="flex items-center space-x-1">
              <FormField
                control={form.control}
                name="isLogoHidden"
                render={({ field }) => (
                  <FormItem className="flex w-full items-center gap-2 space-y-0">
                    <FormControl>
                      <Switch
                        id="isLogoHidden"
                        checked={!!field.value}
                        onCheckedChange={(checked) => field.onChange(checked)}
                      />
                    </FormControl>
                    <div>
                      <FormLabel>
                        {t("environments.surveys.edit.hide_logo")}
                        <Badge type="gray" size="normal" text={t("common.link_surveys")} />
                      </FormLabel>
                      <FormDescription>
                        {t("environments.surveys.edit.hide_the_logo_in_this_specific_survey")}
                      </FormDescription>
                    </div>
                  </FormItem>
                )}
              />
            </div>
          )}

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
                          <FormDescription className="text-xs font-normal text-slate-500">
                            {t("environments.surveys.edit.add_highlight_border_description")}
                          </FormDescription>
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
        </div>
      </Collapsible.CollapsibleContent>
    </Collapsible.Root>
  );
};
