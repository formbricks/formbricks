"use client";

import { useAutoAnimate } from "@formkit/auto-animate/react";
import * as Collapsible from "@radix-ui/react-collapsible";
import { CheckIcon } from "lucide-react";
import Image from "next/image";
import React, { ChangeEvent, useRef, useState } from "react";
import { UseFormReturn } from "react-hook-form";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { TProjectStyling } from "@formbricks/types/project";
import { TSurveyStyling } from "@formbricks/types/surveys/types";
import { cn } from "@/lib/cn";
import { handleFileUpload } from "@/modules/storage/file-upload";
import { AdvancedOptionToggle } from "@/modules/ui/components/advanced-option-toggle";
import { Button } from "@/modules/ui/components/button";
import { ColorPicker } from "@/modules/ui/components/color-picker";
import { FileInput } from "@/modules/ui/components/file-input";
import { FormControl, FormDescription, FormField, FormItem, FormLabel } from "@/modules/ui/components/form";
import { Input } from "@/modules/ui/components/input";
import { showStorageNotConfiguredToast } from "@/modules/ui/components/storage-not-configured-toast/lib/utils";
import { Switch } from "@/modules/ui/components/switch";

type LogoSettingsCardProps = {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  environmentId: string;
  form: UseFormReturn<TProjectStyling | TSurveyStyling>;
  disabled?: boolean;
  isStorageConfigured: boolean;
};

export const LogoSettingsCard = ({
  open,
  setOpen,
  environmentId,
  form,
  disabled = false,
  isStorageConfigured,
}: LogoSettingsCardProps) => {
  const { t } = useTranslation();
  const [parent] = useAutoAnimate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isLoading, setIsLoading] = useState(false);

  const logoUrl = form.watch("logo")?.url;
  const logoBgColor = form.watch("logo")?.bgColor;
  const isBgColorEnabled = !!logoBgColor;
  const isLogoHidden = form.watch("isLogoHidden");

  const setLogoUrl = (url: string | undefined) => {
    const currentLogo = form.getValues("logo");
    form.setValue("logo", url ? { ...currentLogo, url } : undefined);
  };

  const setLogoBgColor = (bgColor: string | undefined) => {
    const currentLogo = form.getValues("logo");
    form.setValue("logo", {
      ...currentLogo,
      url: logoUrl,
      bgColor,
    });
  };

  const handleFileInputChange = async (files: string[]) => {
    if (files.length > 0) {
      setLogoUrl(files[0]);
    }
  };

  const handleHiddenFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    if (!isStorageConfigured) {
      showStorageNotConfiguredToast();
      return;
    }

    const file = event.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    try {
      const uploadResult = await handleFileUpload(file, environmentId);
      if (uploadResult.error) {
        toast.error(t("common.upload_failed"));
        return;
      }
      setLogoUrl(uploadResult.url);
    } catch {
      toast.error(t("common.upload_failed"));
    } finally {
      setIsLoading(false);
      // Reset the input so the same file can be selected again
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleRemoveLogo = () => {
    form.setValue("logo", undefined);
  };

  const toggleBackgroundColor = (enabled: boolean) => {
    setLogoBgColor(enabled ? logoBgColor || "#f8f8f8" : undefined);
  };

  const handleBgColorChange = (color: string) => {
    setLogoBgColor(color);
  };

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
        <div className="inline-flex w-full px-4 py-4">
          <div className="flex items-center pl-2 pr-5">
            <CheckIcon
              strokeWidth={3}
              className="h-7 w-7 rounded-full border border-green-300 bg-green-100 p-1.5 text-green-600"
            />
          </div>

          <div>
            <p className="text-base font-semibold text-slate-800">
              {t("environments.surveys.edit.logo_settings")}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              {t("environments.surveys.edit.customize_survey_logo")}
            </p>
          </div>
        </div>
      </Collapsible.CollapsibleTrigger>

      <Collapsible.CollapsibleContent className="flex flex-col" ref={parent}>
        <hr className="py-1 text-slate-600" />

        <div className="flex flex-col gap-6 p-6 pt-2">
          <FormField
            control={form.control}
            name="isLogoHidden"
            render={({ field }) => (
              <FormItem className="flex items-center gap-2 space-y-0">
                <FormControl>
                  <Switch checked={!!field.value} onCheckedChange={field.onChange} disabled={disabled} />
                </FormControl>
                <div>
                  <FormLabel className="text-base font-semibold text-slate-900">
                    {t("environments.surveys.edit.hide_logo")}
                  </FormLabel>
                  <FormDescription className="text-sm text-slate-800">
                    {t("environments.surveys.edit.hide_logo_from_survey")}
                  </FormDescription>
                </div>
              </FormItem>
            )}
          />

          {!isLogoHidden && (
            <div className="space-y-4">
              <div className="font-medium text-slate-800">
                {t("environments.surveys.edit.overwrite_survey_logo")}
              </div>

              {/* Hidden file input for replacing logo */}
              <Input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg, image/png, image/webp, image/heic"
                className="hidden"
                disabled={disabled}
                onChange={handleHiddenFileChange}
              />

              {logoUrl ? (
                <>
                  <div className="flex items-center gap-4">
                    <Image
                      src={logoUrl}
                      alt="Survey Logo"
                      width={256}
                      height={56}
                      style={{ backgroundColor: logoBgColor || undefined }}
                      className="h-20 w-auto max-w-64 rounded-lg border object-contain p-1"
                    />
                  </div>

                  <div className="flex gap-2">
                    <Button
                      type="button"
                      onClick={() => {
                        if (!isStorageConfigured) {
                          showStorageNotConfiguredToast();
                          return;
                        }

                        fileInputRef.current?.click();
                      }}
                      variant="secondary"
                      size="sm"
                      disabled={disabled || isLoading}>
                      {t("environments.project.look.replace_logo")}
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={handleRemoveLogo}
                      disabled={disabled}>
                      {t("environments.project.look.remove_logo")}
                    </Button>
                  </div>

                  <AdvancedOptionToggle
                    isChecked={isBgColorEnabled}
                    onToggle={toggleBackgroundColor}
                    htmlId="surveyLogoBgColor"
                    title={t("environments.project.look.add_background_color")}
                    description={t("environments.project.look.add_background_color_description")}
                    childBorder
                    customContainerClass="p-0"
                    childrenContainerClass="overflow-visible"
                    disabled={disabled}>
                    {isBgColorEnabled && (
                      <div className="px-2">
                        <ColorPicker
                          color={logoBgColor || "#f8f8f8"}
                          onChange={handleBgColorChange}
                          disabled={disabled}
                        />
                      </div>
                    )}
                  </AdvancedOptionToggle>
                </>
              ) : (
                <FileInput
                  id="survey-logo-input"
                  allowedFileExtensions={["png", "jpeg", "jpg", "webp", "heic"]}
                  environmentId={environmentId}
                  onFileUpload={handleFileInputChange}
                  disabled={disabled}
                  maxSizeInMB={5}
                  isStorageConfigured={isStorageConfigured}
                />
              )}
            </div>
          )}
        </div>
      </Collapsible.CollapsibleContent>
    </Collapsible.Root>
  );
};
