"use client";

import * as Collapsible from "@radix-ui/react-collapsible";
import { CheckIcon } from "lucide-react";
import React from "react";
import { UseFormReturn } from "react-hook-form";
import { cn } from "@formbricks/lib/cn";
import { COLOR_DEFAULTS } from "@formbricks/lib/styling/constants";
import { TProduct, TProductStyling } from "@formbricks/types/product";
import { TSurveyStyling, TSurveyType } from "@formbricks/types/surveys/types";
import { Badge } from "@formbricks/ui/Badge";
import { CardArrangementTabs } from "@formbricks/ui/CardArrangementTabs";
import { ColorPicker } from "@formbricks/ui/ColorPicker";
import { FormControl, FormDescription, FormField, FormItem, FormLabel } from "@formbricks/ui/Form";
import { Slider } from "@formbricks/ui/Slider";
import { Switch } from "@formbricks/ui/Switch";

type CardStylingSettingsProps = {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isSettingsPage?: boolean;
  surveyType?: TSurveyType;
  disabled?: boolean;
  product: TProduct;
  form: UseFormReturn<TProductStyling | TSurveyStyling>;
};

export const CardStylingSettings = ({
  isSettingsPage = false,
  surveyType,
  disabled,
  open,
  product,
  setOpen,
  form,
}: CardStylingSettingsProps) => {
  const isAppSurvey = surveyType === "app" || surveyType === "website";
  const surveyTypeDerived = isAppSurvey ? "App / Website" : "Link";
  const isLogoVisible = !!product.logo?.url;

  const linkCardArrangement = form.watch("cardArrangement.linkSurveys") ?? "simple";
  const appCardArrangement = form.watch("cardArrangement.appSurveys") ?? "simple";
  const roundness = form.watch("roundness") ?? 8;

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
              Card Styling
            </p>
            <p className={cn("mt-1 text-slate-500", isSettingsPage ? "text-xs" : "text-sm")}>
              Style the survey card.
            </p>
          </div>
        </div>
      </Collapsible.CollapsibleTrigger>

      <Collapsible.CollapsibleContent>
        <hr className="py-1 text-slate-600" />

        <div className="flex flex-col gap-6 p-6 pt-2">
          <div className="flex flex-col justify-center">
            <FormField
              control={form.control}
              name="roundness"
              render={() => (
                <FormItem>
                  <div>
                    <FormLabel>Roundness</FormLabel>
                    <FormDescription>Change the border radius of the card and the inputs.</FormDescription>
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
                  <FormLabel>Card background color</FormLabel>
                  <FormDescription>Change the background color of the card.</FormDescription>
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
                  <FormLabel>Card border color</FormLabel>
                  <FormDescription>Change the border color of the card.</FormDescription>
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
            name="cardShadowColor.light"
            render={({ field }) => (
              <FormItem className="space-y-4">
                <div>
                  <FormLabel>Card shadow color</FormLabel>
                  <FormDescription>Change the shadow color of the card.</FormDescription>
                </div>

                <FormControl>
                  <ColorPicker
                    color={field.value || COLOR_DEFAULTS.cardShadowColor}
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
                  <FormLabel>Card Arrangement for {surveyTypeDerived} Surveys</FormLabel>

                  <FormDescription>
                    How funky do you want your cards in {surveyTypeDerived} Surveys
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
                    <FormLabel>Hide progress bar</FormLabel>
                    <FormDescription>Disable the visibility of survey progress.</FormDescription>
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
                        Hide logo
                        <Badge text="Link Surveys" type="gray" size="normal" />
                      </FormLabel>
                      <FormDescription>Hides the logo in this specific survey</FormDescription>
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
                          <FormLabel>Add highlight border</FormLabel>
                          <FormDescription className="text-xs font-normal text-slate-500">
                            Add an outer border to your survey card.
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
