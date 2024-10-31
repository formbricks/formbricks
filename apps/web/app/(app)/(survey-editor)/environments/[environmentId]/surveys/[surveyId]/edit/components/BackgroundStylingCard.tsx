"use client";

import { useAutoAnimate } from "@formkit/auto-animate/react";
import * as Collapsible from "@radix-ui/react-collapsible";
import { CheckIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { UseFormReturn } from "react-hook-form";
import { cn } from "@formbricks/lib/cn";
import { TProductStyling } from "@formbricks/types/product";
import { TSurveyStyling } from "@formbricks/types/surveys/types";
import { Badge } from "@formbricks/ui/components/Badge";
import { FormControl, FormDescription, FormField, FormItem, FormLabel } from "@formbricks/ui/components/Form";
import { Slider } from "@formbricks/ui/components/Slider";
import { SurveyBgSelectorTab } from "./SurveyBgSelectorTab";

interface BackgroundStylingCardProps {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  colors: string[];
  isSettingsPage?: boolean;
  disabled?: boolean;
  environmentId: string;
  isUnsplashConfigured: boolean;
  form: UseFormReturn<TProductStyling | TSurveyStyling>;
}

export const BackgroundStylingCard = ({
  open,
  setOpen,
  colors,
  isSettingsPage = false,
  disabled,
  environmentId,
  isUnsplashConfigured,
  form,
}: BackgroundStylingCardProps) => {
  const t = useTranslations();
  const [parent] = useAutoAnimate();

  return (
    <Collapsible.Root
      open={open}
      onOpenChange={(openState) => {
        if (disabled) return;
        setOpen(openState);
      }}
      className={cn(
        open ? "" : "hover:bg-slate-50",
        "w-full space-y-2 rounded-lg border border-slate-300 bg-white"
      )}>
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
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <p className={cn("font-semibold text-slate-800", isSettingsPage ? "text-sm" : "text-base")}>
                {t("environments.surveys.edit.background_styling")}
              </p>
              {isSettingsPage && <Badge text={t("common.link_surveys")} type="gray" size="normal" />}
            </div>
            <p className={cn("mt-1 text-slate-500", isSettingsPage ? "text-xs" : "text-sm")}>
              {t("environments.surveys.edit.change_the_background_to_a_color_image_or_animation")}
            </p>
          </div>
        </div>
      </Collapsible.CollapsibleTrigger>
      <Collapsible.CollapsibleContent className="flex flex-col" ref={parent}>
        <hr className="pt-1 text-slate-600" />
        <div className="flex flex-col gap-6 p-6 pt-2">
          <FormField
            control={form.control}
            name="background"
            render={({ field }) => (
              <FormItem>
                <div>
                  <FormLabel>{t("environments.surveys.edit.change_background")}</FormLabel>
                  <FormDescription>
                    {t("environments.surveys.edit.pick_a_background_from_our_library_or_upload_your_own")}
                  </FormDescription>
                </div>

                <FormControl>
                  <SurveyBgSelectorTab
                    bg={field.value?.bg ?? ""}
                    handleBgChange={(bg: string, bgType: string) => {
                      field.onChange({
                        ...field.value,
                        bg,
                        bgType,
                        brightness: 100,
                      });
                    }}
                    colors={colors}
                    bgType={field.value?.bgType ?? "color"}
                    environmentId={environmentId}
                    isUnsplashConfigured={isUnsplashConfigured}
                  />
                </FormControl>
              </FormItem>
            )}
          />

          <div className="flex flex-col justify-center">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col justify-center">
                <FormField
                  control={form.control}
                  name="background.brightness"
                  render={({ field }) => (
                    <FormItem>
                      <div>
                        <FormLabel>{t("environments.surveys.edit.brightness")}</FormLabel>
                        <FormDescription>
                          {t("environments.surveys.edit.darken_or_lighten_background_of_your_choice")}
                        </FormDescription>
                      </div>

                      <FormControl>
                        <div className="rounded-lg border bg-slate-50 p-6">
                          <Slider
                            value={[field.value ?? 100]}
                            max={200}
                            onValueChange={(value) => {
                              field.onChange(value[0]);
                            }}
                          />
                        </div>
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>
            </div>
          </div>
        </div>
      </Collapsible.CollapsibleContent>
    </Collapsible.Root>
  );
};
